// DotNet CLR API
(function () {
    "use strict";
	
	var Struct = Win32.Struct;
	
    var _CLR = null;
    Object.defineProperty(global, "CLR", { get: function () {
        if (_CLR == null) { _CLR = new CreateCLR(); }
        return _CLR;
    }});
    function CreateCLR() {
        var BridgeExports = {};
		var BridgePtr = null;
        var assembly_load_counter = 0;

        function ExposeMethodsFromType(self, typeInfo) {
            function CreateMethod(self, method) {
                var invokeMethod = function () { return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0)); };
                invokeMethod.Of = function () {
                    var genericTypes = CLR.GetType("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);
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
                    } catch (e) { } // BUG: 'MaxWorkingSet may not be redefined.'
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
                                    if (typeof delegate == "string") { delegate = new ClrObject(JSON.parse(delegate)); }
                                    return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
                                };
                                // This makes it "" + other.toString() in the setter below when doing "handler += other"
                                this.toString = function () { return ""; }
                            }
                            return EventHandler;
                        },
                        set: function (objHandle_string) {
                            self.$Clr_Invoke("add_" + shortMethodName, [new ClrObject(JSON.parse(objHandle_string))]);
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
        };

        function ExposeNestedTypesFromType(self, typeInfo) {
            function CreateValue(self, name) {
                try {
                    var shortName = name.replace(typeInfo.TypeName + "+", "");
                    var _instance = null;
                    var current_counter = 0;
                    Object.defineProperty(self, shortName, { get: function () {
                        if (_instance == null || current_counter != assembly_load_counter) {
                            current_counter = assembly_load_counter;
                            _instance = CLR.GetType(name);
                        }
                        return _instance;
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
        };

        var all_Objects = [];
		var callback_objects = [];
        var saved_Objects = [];

        var ClrObject = function (objHandle) {
            var typeInfo = CLR.GetType(NULL, objHandle).$Clr_TypeInfo;
            this.$Clr_IsClrObject = true;
            this.$Clr_TypeInfo = typeInfo;
            this.$Clr_Handle = objHandle;
            this.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
                //console.log("ClrObject Invoke " + method);
                return ResolveResult(BridgeExports.InvokeMethod(
                    Memory.allocUtf16String(JSON.stringify(objHandle)), Memory.allocUtf16String(typeInfo.TypeName),
                    Memory.allocUtf16String(method), Memory.allocUtf16String(ResolveArgs(args)),
                    genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes)) : NULL,
                    returnBoxed ? 1 : 0));
            };

            this.Destroy = function () {
                var idx = all_Objects.indexOf(this);
                if (idx > -1) { all_Objects.splice(idx, 1); }
                ResolveResult(BridgeExports.ReleaseObject(Memory.allocUtf16String(JSON.stringify(objHandle))));
            };

            this.$Clr_Pin = function () {
                all_Objects.splice(all_Objects.indexOf(this), 1);
                saved_Objects.push(this);
            }

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
        };

        var ResolveResult = function (result) {
            if (result == null) { return null; }
            if (Memory.readUtf16String(result) == null) { return null; }
            var retObj = JSON.parse(Memory.readUtf16String(result));
            if (retObj == null) { return null; }
            if (retObj.__ERROR) { throw Error(retObj.Message + "\n" + retObj.Stack + "\n") }
            if (retObj.__OBJECT) { retObj = new ClrObject(retObj); }
            return retObj;
        };

        var ResolveArgs = function (params) {
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
        };

        var GetTypeByName = function (typeName) {
            var type = CLR.GetType("System.Type").GetType(typeName);
            if (type != null) return type;
            var asm = CLR.GetType("System").AppDomain.CurrentDomain.GetAssemblies();
            var asmLength = asm.Length;
            for (var i = 0; i < asmLength; i++) {
                type = asm.GetValue(i).GetType(typeName);
                if (type != null) { return type; }
            }
            return null;
        }

        var MakeClrType = function (typeInfo) {
            var ConstructorFunction = function (delegate_proc) {
                // don't .slice the callback function
                var args = typeInfo.IsDelegate ? delegate_proc : Array.prototype.slice.call(arguments);
                return CLR.New(typeInfo.TypeName, args);
            };

            ConstructorFunction.$Clr_IsClrType = true;
            ConstructorFunction.$Clr_TypeOf = function () { return GetTypeByName(typeInfo.TypeName); }
            ConstructorFunction.$Clr_TypeInfo = typeInfo;
            ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
                //console.log("ClrType Invoke " + method + " " + typeInfo.TypeName + " " + JSON.stringify(genericTypes));
                return ResolveResult(BridgeExports.InvokeMethod(
                    NULL, Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(method), Memory.allocUtf16String(ResolveArgs(args)),
                    genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL,
                    returnBoxed ? 1 : 0));
            };

            // RISK: these may be overwritten below by typeInfo.
            ConstructorFunction.toString = function () { return "[ClrType " + typeInfo.TypeName + "]"; }
            ConstructorFunction.Of = function () {
                var genericTypes = CLR.GetType("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);
                for (var i = 0; i < arguments.length; ++i) { genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i); }
                var genericType = CLR.GetType(typeInfo.TypeName + "`" + arguments.length).$Clr_TypeOf().MakeGenericType(genericTypes);
                return CLR.GetType(genericType.FullName);
            };

            ExposeMethodsFromType(ConstructorFunction, typeInfo); // Static
            ExposeNestedTypesFromType(ConstructorFunction, typeInfo); // Nested types
            return ConstructorFunction;
        };

        var DelegateCallback = function (delegateProc) {
            return new NativeCallback(function (args_json) {
                //console.log("Delegate Callback Invoked " + Memory.readUtf16String(args_json));
                var args_list = JSON.parse(Memory.readUtf16String(args_json));

                for (var i = 0; i < args_list.length; ++i) {
                    if (args_list[i].__OBJECT) {
                        args_list[i] = new ClrObject(args_list[i]);
                    }
                }
                var ret_obj = delegateProc.apply(delegateProc, args_list);

                if (Object.prototype.toString.call(ret_obj) === '[object Array]') {
                    for (var i = 0; i < ret_obj.length; ++i) {
                        if (ret_obj[i].$Clr_IsClrObject) {
                            ret_obj[i] = ret_obj[i].$Clr_Handle;
                        }
                    }
                }

                if (ret_obj) {
                    if (ret_obj.$Clr_IsClrObject) {
                        ret_obj = ret_obj.$Clr_Handle;
                    }
                    //console.log("Delegate Ret: " + JSON.stringify(ret_obj));
                    return Memory.allocUtf16String(JSON.stringify(ret_obj));;
                }
                return NULL;
            }, 'pointer', ['pointer'], Win32.Abi);

        };

        // SHADOW API
        this.New = function (typeName, args) {
            var typeInfo = CLR.GetType(typeName).$Clr_TypeInfo;
            // console.log("CLR.New " + typeName);
            if (typeInfo.IsDelegate) {
				var dc = DelegateCallback(args);
				// If we don't do this, the GC is so quick it'll never be able to call back and AV.
				callback_objects.push(dc);
                return ResolveResult(BridgeExports.CreateDelegate(Memory.allocUtf16String(typeName), new Int64("" + dc)));
            } else {
                return ResolveResult(BridgeExports.CreateObject(Memory.allocUtf16String(typeName), Memory.allocUtf16String(ResolveArgs(args))));
            }
        }

        this.GetType = function (typeName, objHandle) {
            //console.log("CLR.GetType " + (typeof objHandle === 'undefined' ? typeName : objHandle.Id));
            if (typeof typeName === "string") {
                typeName = Memory.allocUtf16String(typeName);
            }
            if (typeof objHandle === 'undefined') {
                objHandle = NULL;
            } else {
                objHandle = Memory.allocUtf16String(JSON.stringify(objHandle));
            }
            return MakeClrType(ResolveResult(BridgeExports.DescribeObject(typeName, objHandle)));
        }

        this.GetNamespace = function (namespaceName) {
            var GetNamespaceImpl = function (namespaceName) {
                //console.log("Resolve Namespace " + namespaceName);
                var namespaceInfo = ResolveResult(BridgeExports.DescribeNamespace(Memory.allocUtf16String(namespaceName)));
                this.$Clr_TypeInfo = namespaceInfo;
                function CreateProperty(self, leafName, isType, callback) {
                    try {
                        var is_mangled = false;
                        var resolved_leaf_name = leafName;
                        if (leafName.indexOf("`") > -1) {
                            is_mangled = true;
                            resolved_leaf_name = leafName.substring(0, leafName.indexOf("`"));
                        }

                        var _instance = null;
                        var current_counter = 0;
                        Object.defineProperty(self, resolved_leaf_name, { get: function () {
                            if (_instance == null || current_counter != assembly_load_counter) {
                                current_counter = assembly_load_counter;
                                _instance = callback(resolved_leaf_name, isType, is_mangled)
                            }
                            return _instance;
                        }});
                    } catch (e) {
                        // console.warn("couldn't define " + leafName + " on " + namespaceName + ":\n" + e);
                    }
                }

                this.Expire = function () { assembly_load_counter++; };

                for (var i = 0; i < namespaceInfo.length; ++i) {
                    CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType,
                        function (leafName, isType, isMangled) {
                            var fullLeafName = namespaceName + "." + leafName;
                            if (isType) {
                                if (isMangled) {
                                    // The problem is that we are given Func`1 and we can't be sure that Func will exist.
                                    // If it does, we need to use that, but if it doesn't, we need to hand back something that 
                                    // .Of(T) may be called on.
                                    try {
                                        return CLR.GetType(fullLeafName);
                                    } catch (e) {
                                        return MakeClrType({ TypeName: fullLeafName });
                                    }
                                }
                                return CLR.GetType(fullLeafName);
                            } else {
                                return CLR.GetNamespace(fullLeafName);
                            }
                        });
                }
            }
            return new GetNamespaceImpl(namespaceName);
        }

        this.AddNamespace = function (topLevelNamespaceName) {
            var _instance = null;
            var current_counter = 0;
            Object.defineProperty(global, topLevelNamespaceName, { get: function () {
                if (_instance == null || current_counter != assembly_load_counter) {
                    current_counter = assembly_load_counter;
                    _instance = CLR.GetNamespace(topLevelNamespaceName);
                }
                return _instance;
            }});
        };
        // GARBAGE COLLECTION
        this.Prune = function () {
            var outstanding = all_Objects.length;
            for (var i = outstanding - 1; i > -1; --i) { // backwards because Destroy removes from all_Objects.
                all_Objects[i].Destroy();
            }
            return outstanding;
        }
        this.Pin = function (obj) { obj.$Clr_Pin(); }
        // DEBUG
        this.EnableTraceListener = function () {
            var System = CLR.GetNamespace("System");
            var tracingThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
                var traceBuffer = System.Array.CreateInstance(System.Byte.$Clr_TypeOf(), 1024 * 1024 * 1024); // TODO: can't threadsafe reset tho
                CLR.Pin(traceBuffer);
                var write_ms = new System.IO.MemoryStream(traceBuffer, true);
                CLR.Pin(write_ms);
                System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(write_ms));
                // ThreadProc
                var last_write = 0;
                while (true) {
                    System.Diagnostics.Trace.Flush();
                    var newLength = write_ms.Position;
                    if (last_write != newLength) {
                        var line = System.Text.Encoding.UTF8.GetString(traceBuffer, last_write, (newLength - last_write));
                        last_write = newLength;

                        var spl = line.split("\n")
                        for (var lx in spl) {
                            if (spl[lx]) { console.log("DotNet: " + spl[lx].trim()); }
                        }
                    }
                    System.Threading.Thread.Sleep(500);
                }
            }));
            tracingThread.Start();
        }

		this.Init = function () {
			// Connect to the bridge
			var CLSID_DotNetBridge = Win32.GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
			var IDotNetBridge = new COM.Interface(COM.IUnknown, {
				CreateObject: [0, ['pointer', 'pointer', 'pointer']],
				DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
				CreateDelegate: [2, ['pointer', 'int64', 'pointer']],
				InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
				ReleaseObject: [4, ['pointer', 'pointer']],
				DescribeNamespace: [5, ['pointer', 'pointer']],
			}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

			//COM.Initialize(COM.ApartmentType.MTA);
			var bridge = COM.CreateInstance(CLSID_DotNetBridge, COM.ClassContext.InProc, IDotNetBridge);
			BridgePtr = bridge;
			function wrap(bridge, method) {
				return function () {
					var args = [];
					for (var i = 0; i < arguments.length; ++i) { args[i] = arguments[i]; }
					var outPtr = new Struct({ 'value': 'pointer' });
					args[args.length] = outPtr.Get();

					//console.log("CALLING: " + method);
					COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));
					//console.log("END    : " + method);
					return outPtr.value;
				};
			}
			BridgeExports = {
				CreateObject: wrap(bridge, "CreateObject"),
				DescribeObject: wrap(bridge, "DescribeObject"),
				CreateDelegate: wrap(bridge, "CreateDelegate"),
				InvokeMethod: wrap(bridge, "InvokeMethod"),
				ReleaseObject: wrap(bridge, "ReleaseObject"),
				DescribeNamespace: wrap(bridge, "DescribeNamespace"),
			};

			// We need to re-evaluate namespaces when assemblies have been added.
			CLR.GetNamespace("System").AppDomain.CurrentDomain.AssemblyLoad += new CLR.GetNamespace("System").AssemblyLoadEventHandler(function (s, e) {
				assembly_load_counter++;
		    });
		}
    }
})();