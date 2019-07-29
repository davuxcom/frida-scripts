"use strict";

// GOAL: Using the registered COM DotNetBridge.dll, expose an object model for .net objects.

const Win32 = require('./win32');
const Struct = require('./struct');
const GUID = require('./guid');
const COM = require('./com');
const LocalSettings = require('../local_settings');

function Warn(message) { if ("CLRWarn" in global) console.warn(message); }
function Log(message) { if ("CLRDebug" in global) console.log(message); }

// InProc component that is expected to be found in the registry.
var CLSID_DotNetBridge = GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
var IDotNetBridge = new COM.Interface(COM.IUnknown, {
    CreateObject: [0, ['pointer', 'pointer', 'pointer']],
    DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
    CreateDelegate: [2, ['pointer', 'pointer', 'pointer']],
    InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
    ReleaseObject: [4, ['pointer', 'pointer']],
    DescribeNamespace: [5, ['pointer', 'pointer']],
    SwitchToAppDomain: [6, ['pointer', 'pointer', 'pointer']],
}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

var Kernel32 = {	
    LoadLibrary: new NativeFunction(Module.findExportByName("kernel32.dll", "LoadLibraryW"), 'pointer', ['pointer'], Win32.Abi),	
};	
Kernel32.LoadLibrary(Memory.allocUtf16String("mscoree.dll"));	

var MSCorEE = {	
    CLRCreateInstance: new NativeFunction(Module.findExportByName("MSCorEE.dll", "CLRCreateInstance"), 'uint', ['pointer', 'pointer', 'pointer'], Win32.Abi),	
};

var CLSID_CLRMetaHost = GUID.alloc("9280188d-0e8e-4867-b30c-7fa83884e8de");	
var ICLRMetaHost = new COM.Interface(COM.IUnknown, {	
    GetRuntime: [0, ['pointer','pointer','pointer']],
    EnumerateInstalledRuntimes: [2, ['pointer']],	
}, "D332DB9E-B9B3-4125-8207-A14884F53216");	

var ICLRRuntimeInfo = new COM.Interface(COM.IUnknown, {	
    GetVersionString: [0, ['pointer', 'pointer']],	
    GetInterface: [6, ['pointer', 'pointer', 'pointer']],	
    IsStarted: [11, ['pointer', 'pointer']],
}, "BD39D1D2-BA2F-486a-89B0-B4B0CB466891");	

var CLSID_CLRRuntimeHost = GUID.alloc("90F1A06E-7712-4762-86B5-7A5EBA6BDB02");	
var ICLRRuntimeHost = new COM.Interface(COM.IUnknown, {	
    Start: [0, []],	
    ExecuteInDefaultAppDomain: [8, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer']],	
}, "90F1A06C-7712-4762-86B5-7A5EBA6BDB02");	

function DotNetBridge() {
    console.log("[*] Creating DotNetBridge");
    
    var bridge = new COM.Pointer(IDotNetBridge);

    var metaHost = new COM.Pointer(ICLRMetaHost);
    COM.ThrowIfFailed(MSCorEE.CLRCreateInstance(CLSID_CLRMetaHost, ICLRMetaHost.IID, metaHost.GetAddressOf()));
    
    var runtimeInfo = new COM.Pointer(ICLRRuntimeInfo);
    COM.ThrowIfFailed(metaHost.GetRuntime(Memory.allocUtf16String("v4.0.30319"), ICLRRuntimeInfo.IID, runtimeInfo.GetAddressOf()));
    
    var pbStarted = new Struct({value:'uint'});	
    var pdwStartupFlags = new Struct({value:'uint'});	
    COM.ThrowIfFailed(runtimeInfo.IsStarted(pbStarted.Get(), pdwStartupFlags.Get()));
    
    var runtimeHost = new COM.Pointer(ICLRRuntimeHost);	
    COM.ThrowIfFailed(runtimeInfo.GetInterface(CLSID_CLRRuntimeHost, ICLRRuntimeHost.IID, runtimeHost.GetAddressOf()));
    if (pbStarted.value == 0) {
        console.log("[*] Starting CLR...");
        COM.ThrowIfFailed(runtimeHost.Start());
    }
    
    var cb = new NativeCallback(function(bridgePtr) {
        console.log("[*] Got bridge: " + bridgePtr);
        bridge.Attach(bridgePtr);
    }, 'void', ['pointer'], Win32.Abi);
    
    var assemblyPath = LocalSettings.ScriptRoot + (Process.pointerSize == 4 ? "x86" : "x64") + "/Debug/DotNetBridge.dll";

    console.log("[*] Starting: " + assemblyPath);
    var ret = new Struct({ 'value': 'uint' });	
    COM.ThrowIfFailed(runtimeHost.ExecuteInDefaultAppDomain(
        Memory.allocUtf16String(assemblyPath),	
        Memory.allocUtf16String("DotNetBridge.BootStrapper"), 
        Memory.allocUtf16String("Boot"), 
        Memory.allocUtf16String("" + cb), 
        ret.Get()));
    console.log("[*] Started: " + ret.value);
    
    function SerializedArgsToJson(params) {
        if (typeof params === 'undefined') { params = []; }
        if (Object.prototype.toString.call(params) === '[object Array]') {
            for (var i = 0; i < params.length; ++i) {
                if (params[i] && params[i].$Clr_Serialize) params[i] = params[i].$Clr_Serialize();
            }
            return JSON.stringify(params);
        } else {
            throw new Error("Bad args " + params);
        }
    }
    
    function DoCall(method) {
        var args = [];
        for (var i = 1; i < arguments.length; ++i) { args[i - 1] = arguments[i]; }
        var outPtr = new Struct({ 'value': 'pointer' });
        args[args.length] = outPtr.Get();   

        COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));

        var ret = JSON.parse(Memory.readUtf16String(outPtr.value));
        if (ret && ret.__ERROR) { throw Error(ret.Message + "\n" + ret.Stack + "\n") }
        else if (ret && ret.__OBJECT) { ret = new ObjectWrapper(ret); }
        return ret;
    }
    
    this.CreateObject = function(typeInfo, args) {
        return typeInfo.IsDelegate ? 
            DoCall("CreateDelegate", Memory.allocUtf16String(typeInfo.TypeName), JsonDelegate(args)) :
            DoCall("CreateObject", Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(SerializedArgsToJson(args)));
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
        Log("InvokeMethod: " + method);
        return DoCall("InvokeMethod", 
            objHandle == null ? NULL : Memory.allocUtf16String(JSON.stringify(objHandle)), 
            Memory.allocUtf16String(typeInfo.TypeName), 
            Memory.allocUtf16String(method), 
            Memory.allocUtf16String(SerializedArgsToJson(args)),
            genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL,
            returnBoxed ? 1 : 0);
    }

    this.SwitchToAppDomain = function(targetDomainName, cb) {
        var callback = new NativeCallback(function (argsPtr) {
            console.log("[*] Got updated bridge: " + argsPtr);
            bridge = new COM.Pointer(IDotNetBridge);
            bridge.Attach(argsPtr);
            cb();
            return NULL;
        }, 'pointer', ['pointer'], Win32.Abi);
        
        // Save a pointer somewhere in javascript, the GC is so quick it'll clean up before we have a chance to call back.
        _pinnedNativeCallbackObjects.push(callback);
        DoCall("SwitchToAppDomain", Memory.allocUtf16String(targetDomainName), callback);
    }
}

// Ensure the bridge is a singleton, even if this script is included multiple times.
function GetBridgeInstance() {
    const CLR_BRIDGE_TAG = "$$CLRBRIDGE";
    global[CLR_BRIDGE_TAG] = (CLR_BRIDGE_TAG in global) ? global[CLR_BRIDGE_TAG] : new DotNetBridge();
    return global[CLR_BRIDGE_TAG];
}

const BridgeExports = GetBridgeInstance();
var _objects = [];
var _pinnedNativeCallbackObjects = [];
var _pinnedObjects = [];

function JsonDelegate(func) {
    var callback = new NativeCallback(function (argsPtr) {
        // Unpack json args and resolve object references.
        var args = JSON.parse(Memory.readUtf16String(argsPtr));
        for (var i = 0; i < args.length; ++i) {
            if (args[i].__OBJECT) args[i] = new ObjectWrapper(args[i]);
        }
        
        var ret = func.apply(func, args);
        // Pack up the result into object references
        if (Object.prototype.toString.call(ret) === '[object Array]') {
            for (var i = 0; i < ret.length; ++i) {
                if (ret[i].$Clr_Serialize) ret[i] = ret[i].$Clr_Serialize();
            }
        }
        if (ret) {
            if (ret.$Clr_Serialize) ret = ret.$Clr_Serialize();
            return Memory.allocUtf16String(JSON.stringify(ret));;
        }
        return NULL;
    }, 'pointer', ['pointer'], Win32.Abi);
    
    // Save a pointer somewhere in javascript, the GC is so quick it'll clean up before we have a chance to call back.
    _pinnedNativeCallbackObjects.push(callback);
    return callback;
}

function TypeInstance(typeName) { return new TypeWrapper("System.Type").GetType(typeName); }

function ExposeMethodsFromType(self, typeInfo) {
    function CreateMethod(self, method) {
        var invokeMethod = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0)); };
        invokeMethod.Box = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), null, true); };
        invokeMethod.Of = function () {
            var genericTypes = new TypeWrapper("System.Array").CreateInstance(new TypeInstance("System.Type"), arguments.length);
            for (var i = 0; i < arguments.length; ++i) { genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i); }
            
            var invokeGenericMethod = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes); }
            invokeGenericMethod.Box = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes, true); }
            return invokeGenericMethod;
        };
        // Wire get_ and set_ to a property get/set.
        if ((method.Name.startsWith("get_") && method.Parameters.length == 0) || 
            (method.Name.startsWith("set_") && method.Parameters.length == 1)) {
            try {
                var shortMethodName = method.Name.slice("get_".length);
                Object.defineProperty(self, shortMethodName, {
                    get: function () { return self.$Clr_Invoke("get_" + shortMethodName, []); },
                    set: function (newValue) { return self.$Clr_Invoke("set_" + shortMethodName, [newValue]); },
                });
            } catch (e) { Warn("Can't define '" + shortMethodName + "': " + e); } 
        // wire add_ and remove_ to an event registration object.
        } else if ((method.Name.startsWith("add_") && method.Parameters && method.Parameters.length == 1) || 
                    (method.Name.startsWith("remove_") && method.Parameters && method.Parameters.length == 1)) {
            var shortMethodName = method.Name.substring(method.Name.startsWith("add_") ? "add_".length : "remove_".length)
            if (!self[shortMethodName]) Object.defineProperty(self, shortMethodName, {
                get: function () {
                    return new function () {
                        this.add = function (delegate) {
                            self.$Clr_Invoke("add_" + shortMethodName, [delegate]);
                            return delegate; // delegate.toString() will act as a token for removal.
                        };
                        this.remove = function (delegate) {
                            // token = obj += delegate ... token is delegate.toString which is JSON by convention.
                            if (typeof delegate == "string") { delegate = new ObjectWrapper(JSON.parse(delegate)); }
                            return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
                        };
                        // This makes it "" + other.toString() in the setter below when doing "handler += other"
                        this.toString = function () { return ""; }
                    }
                },
                set: function (objHandle_string) { self.$Clr_Invoke("add_" + shortMethodName, [new ObjectWrapper(JSON.parse(objHandle_string))]); },
            });
        } else {
            self[method.Name] = invokeMethod;
        }
    }
    
    function ExposeField(self, name) {
        Object.defineProperty(self, name, {
            get: function () { return self.$Clr_Invoke(name, []); },
            set: function (value) { return self.$Clr_Invoke(name, [value]); },
        });
    }
    
    for (var i = 0; typeInfo.Methods && i < typeInfo.Methods.length; ++i) { CreateMethod(self, typeInfo.Methods[i]); }
    for (var i = 0; typeInfo.Fields && i < typeInfo.Fields.length; ++i) { ExposeField(self, typeInfo.Fields[i]); }
}

function TypeWrapper(typeNameOrTypeInfo) {
    var typeInfo = typeNameOrTypeInfo;
    if (typeof typeNameOrTypeInfo == "string") {
        typeInfo = BridgeExports.DescribeObject(typeNameOrTypeInfo, null);
    }
    
    function ExposeNestedTypesFromType(self, typeInfo) {
        function CreateValue(self, name) {
            try {
                var shortName = name.replace(typeInfo.TypeName + "+", "");
                Object.defineProperty(self, shortName, { get: function () { return new TypeWrapper(name); }});
            } catch (e) { Warn("Can't define " + name); }
        }

        for (var i = 0; typeInfo.NestedTypes && i < typeInfo.NestedTypes.length; ++i) CreateValue(self, typeInfo.NestedTypes[i]);
    }

    var ConstructorFunction = function () { return BridgeExports.CreateObject(typeInfo, typeInfo.IsDelegate ? arguments[0] : Array.prototype.slice.call(arguments)); };
    ConstructorFunction.toString = function () { return "[ClrType " + typeInfo.TypeName + "]"; }
    ConstructorFunction.$Clr_Serialize = function() { return ConstructorFunction.$Clr_TypeOf().$Clr_Handle; }
    ConstructorFunction.$Clr_TypeOf = function () { return new TypeInstance(typeInfo.TypeName); }
    ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
        return BridgeExports.InvokeMethod(null, typeInfo, method, args, genericTypes, returnBoxed);
    }
    // Dictionary<int,string> -> Dictionary.Of(System.Int, System.String)
    ConstructorFunction.Of = function () {
        var genericTypes = new TypeWrapper("System.Array").CreateInstance(new TypeInstance("System.Type"), arguments.length);
        for (var i = 0; i < arguments.length; ++i) { genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i); }
        var genericType = new TypeWrapper(typeInfo.TypeName + "`" + arguments.length).$Clr_TypeOf().MakeGenericType(genericTypes);
        return new TypeWrapper(genericType.FullName);
    }

    ExposeMethodsFromType(ConstructorFunction, typeInfo);
    ExposeNestedTypesFromType(ConstructorFunction, typeInfo);
    return ConstructorFunction;
}

function ObjectWrapper(objHandle) {
    var typeInfo = BridgeExports.DescribeObject(NULL, objHandle);
    this.$Clr_Serialize = function() { return objHandle; }
    this.$Clr_Handle = objHandle;
    this.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
        return BridgeExports.InvokeMethod(objHandle, typeInfo, method, args, genericTypes, returnBoxed);
    }

    if (typeInfo.IsEnum) {
        this.value = typeInfo.EnumValue;
        this.toString = function () { return this.ToString(); } // Get the symbol name for the current value.
    } else if (typeInfo.IsDelegate) {
        this.toString = function () { return JSON.stringify(objHandle); }; // Used in event add_/remove_ for "+=" semantics.
    } else {
        this.toString = function () { return "[ClrObject " + typeInfo.TypeName + ": " + this.ToString() + "]"; };
    }
    ExposeMethodsFromType(this, typeInfo);
    _objects.push(this);
}

function NamespaceWrapper(namespaceName) {
    function CreateProperty(self, leafName, isType, callback) {
        try {
            var isSimplifiedName = leafName.indexOf("`") > -1;
            var simpleLeafName = isSimplifiedName ? leafName.substring(0, leafName.indexOf("`")) : leafName;
            Object.defineProperty(self, simpleLeafName, { get: function () { return callback(simpleLeafName, isType, isSimplifiedName); }});
        } catch (e) { Warn("Couldn't define " + leafName + " on " + namespaceName + ":\n" + e); }
    }
    
    var namespaceInfo = BridgeExports.DescribeNamespace(namespaceName);
    for (var i = 0; i < namespaceInfo.length; ++i) {
        CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType,
            function (leafName, isType, isMangled) {
                var fullName = namespaceName + "." + leafName;
                if (isType) {
                    try {
                        return new TypeWrapper(fullName);
                    } catch (e) {
                        if (isMangled) {
                            // PROBLEM: Given Func`1, Func *may not* exist.
                            // SOLUTION: Give back an object for the sole purpose of calling .Of() on to access Func`1 and so on.
                            return new TypeWrapper({ TypeName: fullName });
                        } else throw e;
                    }
                } else {
                    return new NamespaceWrapper(fullName);
                }
            });
    }
}

module.exports = {
    Namespace: NamespaceWrapper,
    SwitchToAppDomain: function(targetDomainName, cb) { 
        BridgeExports.SwitchToAppDomain(targetDomainName, cb); 
    },
    ListAppDomains: function() {
        var domains = new NamespaceWrapper("DotNetBridge").AppDomainSwitcher.EnumAppDomains();
        var ret = [];
        for (var i = 0; i < domains.Count; i++) ret[ret.length] = domains.get_Item(i).FriendlyName;
        return ret;
    },
    Prune: function () { // Allow .net GC to clean up objects (remove reference in js and in .net).
        var outstanding = _objects.length;
        for (var i = outstanding - 1; i > -1; --i) BridgeExports.ReleaseObject(_objects[i].$Clr_Handle);
        _objects.length = 0;
        return outstanding;
    },
    Pin: function (obj) { // Prevent an object from being garbage collected.
        _objects.splice(_objects.indexOf(obj), 1);
        _pinnedObjects.push(obj);
    },
};