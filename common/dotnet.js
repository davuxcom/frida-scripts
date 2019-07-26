"use strict";

// GOAL: Using the below DotNetBridge, build JS objects to represent a root namespace and all subsequent types.
//
// Known limitations: We can't create a new type unless we have an assembly to load (which can be done)

const Win32 = require('./win32');
const Struct = require('./struct');
const GUID = require('./guid');
const COM = require('./com');

// InProc component that is expected to be found in the registry.
var CLSID_DotNetBridge = GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
var IDotNetBridge = new COM.Interface(COM.IUnknown, {
    CreateObject: [0, ['pointer', 'pointer', 'pointer']],
    DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
    CreateDelegate: [2, ['pointer', 'pointer', 'pointer']],
    InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
    ReleaseObject: [4, ['pointer', 'pointer']],
    DescribeNamespace: [5, ['pointer', 'pointer']],
}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

function DotNetBridge() {
    console.log("[*] Creating DotNetBridge");
    var bridge = COM.CreateInstance(CLSID_DotNetBridge, COM.ClassContext.InProc, IDotNetBridge);

    function ResolveResult(result) {
        var ret = JSON.parse(Memory.readUtf16String(result));
        if (ret && ret.__ERROR) { throw Error(ret.Message + "\n" + ret.Stack + "\n") }
        else if (ret && ret.__OBJECT) { ret = new ClrObjectWrapper(ret); }
        return ret;
    }
    
    function ResolveArgs(params) {
        if (typeof params === 'undefined') { params = []; }
        if (Object.prototype.toString.call(params) === '[object Array]') {
            for (var i = 0; i < params.length; ++i) {
                if (params[i] && params[i].$Clr_IsClrObject) {
                    params[i] = params[i].$Clr_Handle;
                }
                if (params[i] && params[i].$Clr_IsClrType) {
                    params[i] = params[i].$Clr_TypeOf().$Clr_Handle;
                }
            }
            return JSON.stringify(params);
        }
        else {
            throw new Error("Bad args " + params);
        }
    }
    
    function DoCall(method) {
        var args = [];
        for (var i = 1; i < arguments.length; ++i) { args[i - 1] = arguments[i]; }
        var outPtr = new Struct({ 'value': 'pointer' });
        args[args.length] = outPtr.Get();   

        COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));
        return ResolveResult(outPtr.value);
    }
    
    this.CreateObject = function(typeInfo, args) {
        if (typeInfo.IsDelegate) {
            return DoCall("CreateDelegate", Memory.allocUtf16String(typeInfo.TypeName), JsonDelegate(args));
        } else {
            return DoCall("CreateObject", Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(ResolveArgs(args)));
        }
    }
    
    this.DescribeObject = function(typeName, objHandle) {
        if (typeof typeName === "string") {
            typeName = Memory.allocUtf16String(typeName);
            objHandle = NULL;
        } else {
            objHandle = Memory.allocUtf16String(JSON.stringify(objHandle));
            typeName = NULL;
        }
        return DoCall("DescribeObject", typeName, objHandle);
    }
    
    this.ReleaseObject = function(objHandle) {
        return DoCall("ReleaseObject", Memory.allocUtf16String(JSON.stringify(objHandle)));
    }
    
    this.DescribeNamespace = function(namespaceName) {
        return DoCall("DescribeNamespace", Memory.allocUtf16String(namespaceName));
    }
    
    this.InvokeMethod = function (objHandle, typeInfo, method, args, genericTypes, returnBoxed) {
        return DoCall("InvokeMethod", 
            objHandle == null ? NULL : Memory.allocUtf16String(JSON.stringify(objHandle)), 
            Memory.allocUtf16String(typeInfo.TypeName), 
            Memory.allocUtf16String(method), 
            Memory.allocUtf16String(ResolveArgs(args)),
            genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL,
            returnBoxed ? 1 : 0);
    };
}

// Ensure the bridge is a singleton, even if this script is included multiple times.
function GetBridgeInstance() {
    const CLR_BRIDGE_TAG = "$$CLRBRIDGE";
    global[CLR_BRIDGE_TAG] = (CLR_BRIDGE_TAG in global) ? global[CLR_BRIDGE_TAG] : new DotNetBridge();
    return global[CLR_BRIDGE_TAG];
}

const BridgeExports = GetBridgeInstance();
var all_Objects = [];
var callback_objects = [];
var saved_Objects = [];

function ExposeMethodsFromType(self, typeInfo) {
    function CreateMethod(self, method) {
        var invokeMethod = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0)); };
        invokeMethod.Of = function () {
            var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);
            for (var i = 0; i < arguments.length; ++i) { genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i); }

            var invokeGenericMethod = function () {
                return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes);
            }
            invokeGenericMethod.Box = function () {
                return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes, true);
            };
            return invokeGenericMethod;
        };
        invokeMethod.Box = function () {
            return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), null, true);
        };
        // Wire get_ and set_ to a property get/set.
        if ((method.Name.startsWith("get_") && method.Parameters.length == 0) || (method.Name.startsWith("set_") && method.Parameters.length == 1)) {
            try {
                var shortMethodName = method.Name.slice("get_".length);
                Object.defineProperty(self, shortMethodName, {
                    get: function () { return self.$Clr_Invoke("get_" + shortMethodName, []); },
                    set: function (newValue) { return self.$Clr_Invoke("set_" + shortMethodName, [newValue]); },
                });
            } catch (e) { 
                // console.warn("Can't define " + shortMethodName);
                // BUG: 'MaxWorkingSet may not be redefined.'
                // We can't overwrite reserved keywords.
            } 
        } else if ((method.Name.startsWith("add_") && method.Parameters && method.Parameters.length == 1) || (method.Name.startsWith("remove_") && method.Parameters && method.Parameters.length == 1)) {
            var shortMethodName = method.Name.substring(method.Name.startsWith("add_") ? "add_".length : "remove_".length)

            if (self[shortMethodName]) { return; }
            Object.defineProperty(self, shortMethodName, {
                get: function () {
                    var EventHandler = new function () {
                        this.add = function (delegate) {
                            self.$Clr_Invoke("add_" + shortMethodName, [delegate]);
                            return delegate;
                        };
                        this.remove = function (delegate) {
                            // token = obj += delegate ... token is delegate.toString which is JSON by convention.
                            if (typeof delegate == "string") { delegate = new ClrObjectWrapper(JSON.parse(delegate)); }
                            return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
                        };
                        // This makes it "" + other.toString() in the setter below when doing "handler += other"
                        this.toString = function () { return ""; }
                    }
                    return EventHandler;
                },
                set: function (objHandle_string) {
                    self.$Clr_Invoke("add_" + shortMethodName, [new ClrObjectWrapper(JSON.parse(objHandle_string))]);
                },
            });
        } else {
            self[method.Name] = invokeMethod;
        }
    };

    if (typeInfo.Methods) {
        for (var i = 0; i < typeInfo.Methods.length; ++i) { CreateMethod(self, typeInfo.Methods[i]); }
    }

    function ExposeField(self, name) {
        Object.defineProperty(self, name, {
            get: function () { return self.$Clr_Invoke(name, []); },
            set: function (value) { return self.$Clr_Invoke(name, [value]); },
        });
    }

    if (typeInfo.Fields) {
        for (var i = 0; i < typeInfo.Fields.length; ++i) { ExposeField(self, typeInfo.Fields[i]); }
    }
}

function ExposeNestedTypesFromType(self, typeInfo) {
    function CreateValue(self, name) {
        try {
            var shortName = name.replace(typeInfo.TypeName + "+", "");
            Object.defineProperty(self, shortName, { get: function () {
                return CreateClrTypeWrapper(name);
            }});
        } catch (e) {
            console.warn("Can't define " + name);
        }
    };

    if (typeInfo.NestedTypes) {
        for (var i = 0; i < typeInfo.NestedTypes.length; ++i) {
            CreateValue(self, typeInfo.NestedTypes[i]);
        }
    }
}

function CreateClrTypeWrapperFromInfo(typeInfo) {
    var ConstructorFunction = function () {
        // don't .slice (destroy) the callback argument.
        return BridgeExports.CreateObject(typeInfo, typeInfo.IsDelegate ? arguments[0] : Array.prototype.slice.call(arguments));
    };

    ConstructorFunction.$Clr_IsClrType = true;
    ConstructorFunction.$Clr_TypeOf = function () { return GetTypeByName(typeInfo.TypeName); }
    ConstructorFunction.$Clr_TypeInfo = typeInfo;
    ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
        return BridgeExports.InvokeMethod(null, typeInfo, method, args, genericTypes, returnBoxed);
    };

    ConstructorFunction.toString = function () { return "[ClrType " + typeInfo.TypeName + "]"; }
    // Could be overwritten.
    ConstructorFunction.Of = function () {
        var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);
        for (var i = 0; i < arguments.length; ++i) { genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i); }
        var genericType = CreateClrTypeWrapper(typeInfo.TypeName + "`" + arguments.length).$Clr_TypeOf().MakeGenericType(genericTypes);
        return CreateClrTypeWrapper(genericType.FullName);
    };

    ExposeMethodsFromType(ConstructorFunction, typeInfo); // Static
    ExposeNestedTypesFromType(ConstructorFunction, typeInfo); // Nested types
    return ConstructorFunction;
}

function CreateClrTypeWrapper(typeName, objHandle) {
    return CreateClrTypeWrapperFromInfo(BridgeExports.DescribeObject(typeName, objHandle));
}

function ClrObjectWrapper(objHandle) {
    var typeInfo = BridgeExports.DescribeObject(NULL, objHandle);
    this.$Clr_IsClrObject = true;
    this.$Clr_TypeInfo = typeInfo;
    this.$Clr_Handle = objHandle;
    this.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
        return BridgeExports.InvokeMethod(objHandle, typeInfo, method, args, genericTypes, returnBoxed);
    };

    if (typeInfo.IsEnum) {
        this.value = typeInfo.EnumValue;
        this.toString = function () { return this.ToString(); }
    } else if (typeInfo.IsDelegate) {
        // Used in event add_/remove_ for "+=" semantics.
        this.toString = function () { return JSON.stringify(objHandle); };
    } else {
        this.toString = function () { return "[ClrObject " + typeInfo.TypeName + ": " + this.ToString() + "]"; };
    }
    ExposeMethodsFromType(this, typeInfo);
    all_Objects.push(this);
}

function GetTypeByName(typeName) {
    var type = CreateClrTypeWrapper("System.Type").GetType(typeName);
    if (type != null) return type;
    var asm = CreateClrTypeWrapper("System").AppDomain.CurrentDomain.GetAssemblies();
    var asmLength = asm.Length;
    for (var i = 0; i < asmLength; i++) {
        type = asm.GetValue(i).GetType(typeName);
        if (type != null) { return type; }
    }
    return null;
}

function JsonDelegate(func) {
    var callback = new NativeCallback(function (argsPtr) {
        // Unpack json args and resolve object references.
        var args = JSON.parse(Memory.readUtf16String(argsPtr));
        for (var i = 0; i < args.length; ++i) {
            if (args[i].__OBJECT) {
                args[i] = new ClrObjectWrapper(args[i]);
            }
        }
        
        var ret = func.apply(func, args);
        // Pack up the result into object references
        if (Object.prototype.toString.call(ret) === '[object Array]') {
            for (var i = 0; i < ret.length; ++i) {
                if (ret[i].$Clr_IsClrObject) {
                    ret[i] = ret[i].$Clr_Handle;
                }
            }
        }
        if (ret) {
            if (ret.$Clr_IsClrObject) {
                ret = ret.$Clr_Handle;
            }
            return Memory.allocUtf16String(JSON.stringify(ret));;
        }
        return NULL;
    }, 'pointer', ['pointer'], Win32.Abi);
    
    // If we don't do this, the GC is so quick it'll never be able to call back and AV.
    callback_objects.push(callback);
    return callback;
}

function GetNamespace(namespaceName) {
    return new function() {
        var namespaceInfo = BridgeExports.DescribeNamespace(namespaceName);
        this.$Clr_TypeInfo = namespaceInfo;
        function CreateProperty(self, leafName, isType, callback) {
            try {
                var is_mangled = false;
                var resolved_leaf_name = leafName;
                if (leafName.indexOf("`") > -1) {
                    is_mangled = true;
                    resolved_leaf_name = leafName.substring(0, leafName.indexOf("`"));
                }
                Object.defineProperty(self, resolved_leaf_name, {
                    get: function () {
                        return callback(resolved_leaf_name, isType, is_mangled);
                    }
                });
            } catch (e) {
                // console.warn("couldn't define " + leafName + " on " + namespaceName + ":\n" + e);
            }
        }

        for (var i = 0; i < namespaceInfo.length; ++i) {
            CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType,
                function (leafName, isType, isMangled) {
                    var fullLeafName = namespaceName + "." + leafName;
                    if (isType) {
                        if (isMangled) {
                            // The problem is that we are given Func`1 and we can't be sure that Func will exist.
                            // If it does, we need to use that, but if it doesn't, we need to hand back something that 
                            // .Of(T) may be called on so that the generic types may still be accessed in either case.
                            try {
                                return CreateClrTypeWrapper(fullLeafName);
                            } catch (e) {
                                return CreateClrTypeWrapperFromInfo({ TypeName: fullLeafName });
                            }
                        }
                        return CreateClrTypeWrapper(fullLeafName);
                    } else {
                        return GetNamespace(fullLeafName);
                    }
                });
        }
    }
}

module.exports = {
    GetNamespace: GetNamespace,
    // Basic memory management, note callbacks are still leaked.
    Prune: function () {
        var outstanding = all_Objects.length;
        for (var i = outstanding - 1; i > -1; --i) {
            BridgeExports.ReleaseObject(all_Objects[i].$Clr_Handle);
        }
        all_Objects.length = 0;
        return outstanding;
    },
    Pin: function (obj) {
        all_Objects.splice(all_Objects.indexOf(obj), 1);
        saved_Objects.push(obj);
    },
};