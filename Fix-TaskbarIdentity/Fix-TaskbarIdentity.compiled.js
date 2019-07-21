
(function () {
    "use strict";

    // SHIM: get function.apply fix
    function METHOD_APPLY_SHIM(method, args) {
        if (args.length == 1) { return method(args[0]);
        } else if (args.length == 2) { return method(args[0], args[1]);
        } else if (args.length == 3) { return method(args[0], args[1], args[2]);
        } else if (args.length == 4) { return method(args[0], args[1], args[2], args[3]);
        } else if (args.length == 5) { return method(args[0], args[1], args[2], args[3], args[4]);
        } else if (args.length == 6) { return method(args[0], args[1], args[2], args[3], args[4], args[5]);
        } else if (args.length == 7) { return method(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        } else if (args.length == 8) { return method(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
        } else if (args.length == 9) { return method(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]);
        } else if (args.length == 10) { return method(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[10]);
        } else { throw 'Not implemented for this many args'; }
    }
    // Microsoft APIs use stdcall on x86.
    function GetAbi() { return Process.arch == 'x64' ? 'win64' : 'stdcall'; }

	var TypeMap = {
		'pointer': [Process.pointerSize, Memory.readPointer, Memory.writePointer],
		'char': [1, Memory.readS8, Memory.writeS8], 'uchar': [1, Memory.readU8, Memory.writeU8],
		'int8': [1, Memory.readS8, Memory.writeS8], 'uint8': [1, Memory.readU8, Memory.writeU8],
		'int16': [2, Memory.readS16, Memory.writeS16], 'uint16': [2, Memory.readU16, Memory.writeU16],
		'int': [4, Memory.readS32, Memory.writeS32], 'uint': [4, Memory.readU32, Memory.writeU32],
		'int32': [4, Memory.readS32, Memory.writeS32], 'uint32': [4, Memory.readU32, Memory.writeU32],
		'long': [4, Memory.readS32, Memory.writeS32], 'ulong': [4, Memory.readU32, Memory.writeU32],
		'float': [4, Memory.readFloat, Memory.writeFloat], 'double': [8, Memory.readDouble, Memory.writeDouble],
		'int64': [8, Memory.readS64, Memory.writeS64], 'uint64': [8, Memory.readU64, Memory.writeU64],
	};
	
	// Given a set of definitions, build a javascript object with getters/setters around base_ptr.
    var Struct = function (structInfo) {
        function LookupType(stringType) {
            for (var type in TypeMap) { if (stringType == type) { return TypeMap[type]; } }
            throw Error("Didn't find " + JSON.stringify(stringType) + " in TypeMap");
        }

        var setter_result_cache = {};
        function CreateGetterSetter(self, name, type, offset) {
            Object.defineProperty(self, name, {
                get: function () { return LookupType(type)[1](base_ptr.add(offset)); },
                set: function (newValue) { setter_result_cache[name] = LookupType(type)[2](base_ptr.add(offset), newValue); }
            });
        };

        function SizeOfType(stringType) { return LookupType(stringType)[0]; }

        var base_ptr_size = 0;
        for (var member in structInfo) {
            var member_size = 0;
            if (member == "union") {
                var union = structInfo[member];
                for (var union_member in union) {
                    var union_member_type = union[union_member];
                    var union_member_size = SizeOfType(union_member_type);
                    if (member_size < union_member_size) { member_size = union_member_size; }
                    CreateGetterSetter(this, union_member, union_member_type, base_ptr_size);
                }
            } else {
                var member_size = SizeOfType(structInfo[member]);
                CreateGetterSetter(this, member, structInfo[member], base_ptr_size);
            }
            base_ptr_size += member_size;
        }

		var base_ptr = Memory.alloc(base_ptr_size);

        this.Get = function () { return base_ptr; }
        Object.defineProperty(this, "Size", { get: function () { return base_ptr_size; } });
    }

    var _Win32 = null;
    Object.defineProperty(global, "Win32", { get: function () {
        if (_Win32 == null) { _Win32 = new CreateWin32(); }
        return _Win32;
    }});
    function CreateWin32() {
        var _GUID = null;
        Object.defineProperty(this, "GUID", { get: function () {
                if (_GUID == null) { _GUID = new CreateGUID(); }
                return _GUID;
        }});
        function CreateGUID() {
            var Ole32 = {
                CLSIDFromString: new NativeFunction(Module.findExportByName("ole32.dll", "CLSIDFromString"), 'uint', ['pointer', 'pointer'], GetAbi()),
                StringFromGUID2: new NativeFunction(Module.findExportByName("ole32.dll", "StringFromGUID2"), 'int', ['pointer', 'pointer', 'int'], GetAbi()),
            };
            const guid_size = 16;

            this.alloc = function (guid_string) {
                if (guid_string.length == 32) { // 6fdf6ffced7794fa407ea7b86ed9e59d
                    guid_string = "{" + guid_string.substr(0, 8) + "-" + raw_guid.substr(8, 4) + "-" + raw_guid.substr(12, 4) + "-" + raw_guid.substr(16, 4) + "-" + raw_guid.substr(20) + "}";
                } else if (guid_string.length == 36) { // 6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d
                    guid_string = "{" + guid_string + "}";
                } else if (guid_string.length == 38) { // {6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d}
                    guid_string = guid_string;
                } else {
                    throw Error("Guid is in an unexpected or invalid format.");
                }

                var guidStructPtr = Memory.alloc(guid_size);
                if (0 != Ole32.CLSIDFromString(Memory.allocUtf16String(guid_string), guidStructPtr)) {
                    throw Error("Can't convert string '" + guid_string + "' to GUID.");
                }
                return guidStructPtr;
            }

            this.read = function (guid_ptr) {
                var cbGuidStr = 128; // bytes
                var guidBuffer = Memory.alloc(cbGuidStr);
                if (Ole32.StringFromGUID2(guid_ptr, guidBuffer, cbGuidStr / 2 /* wchar_t */) > 0) {
                    return Memory.readUtf16String(guidBuffer);
                } else {
                    throw Error('Failed to parse guid');
                }
            }
        }
		
		this.TypeMap = TypeMap;
		this.Abi = GetAbi();
		this.Struct = Struct;
    }

    var _WinRT = null;
    Object.defineProperty(global, "WinRT", { get: function () {
        if (_WinRT == null) { _WinRT = new CreateWinRT(); }
        return _WinRT;
    }});
    function CreateWinRT() {
        function FindHiddenExport(moduleName, procName) {
            var Kernel32 = {
                LoadLibrary: new NativeFunction(Module.findExportByName("kernel32.dll", "LoadLibraryW"), 'pointer', ['pointer'], GetAbi()),
                GetProcAddress: new NativeFunction(Module.findExportByName("kernel32.dll", "GetProcAddress"), 'pointer', ['pointer', 'pointer'], GetAbi()),
            };
            var moduleAddr = Kernel32.LoadLibrary(Memory.allocUtf16String(moduleName));
            if (moduleAddr == 0x0) { throw Error("Didn't load " + moduleName); }
            return Kernel32.GetProcAddress(moduleAddr, Memory.allocAnsiString(procName));
        }

        var ComBase = {
            RoInitialize: new NativeFunction(FindHiddenExport("combase.dll", "RoInitialize"), 'uint', ['uint'], GetAbi()),
            RoActivateInstance: new NativeFunction(FindHiddenExport("combase.dll", "RoActivateInstance"), 'uint', ['pointer', 'pointer'], GetAbi()),
            RoGetActivationFactory: new NativeFunction(FindHiddenExport("combase.dll", "RoGetActivationFactory"), 'uint', ['pointer', 'pointer', 'pointer'], GetAbi()),
        };

        this.Initialize = function () { ThrowIfFailed(ComBase.RoInitialize(1)); }; //RO_INIT_MULTITHREADED

        this.ActivateInstance = function (activableClassId) {
            var ret = new COM.Pointer(COM.IInspectable);
            COM.ThrowIfFailed(ComBase.RoActivateInstance(this.HSTRING.alloc(activableClassId), ret.GetAddressOf()));
            //console.log("WinRT.ActivateInstance: " + activableClassId);
            return ret;
        };

        this.GetActivationFactory = function (activableClassId, idl) {
            var ret = new COM.Pointer(idl);
            COM.ThrowIfFailed(ComBase.RoGetActivationFactory(this.HSTRING.alloc(activableClassId), idl.IID, ret.GetAddressOf()));
            //console.log("WinRT.GetActivationFactory: " + activableClassId);
            return ret;
        };

        this.TypedEventHandler = function (callback, guidStr) {
            var eventHandler = new COM.RuntimeObject(Win32.GUID.alloc(guidStr));
            eventHandler.AddEntry(function (this_ptr, s, e) { // Invoke
                callback(new COM.Pointer(COM.IInspectable).Attach(s), new COM.Pointer(COM.IInspectable).Attach(e));
                return COM.S_OK;
            }, 'uint', ['pointer', 'pointer', 'pointer']);
            return eventHandler.GetAddress();
        }

        this.EventRegistrationToken = function () { return new Struct({ value: 'int64' }); }

        var _HSTRING = null;
        Object.defineProperty(this, "HSTRING", { get: function () {
            if (_HSTRING == null) { _HSTRING = new CreateHSTRING(); }
            return _HSTRING;
        }});
        function CreateHSTRING() {
            var ComBase = {
                WindowsCreateString: new NativeFunction(FindHiddenExport("combase.dll", "WindowsCreateString"), 'uint', ['pointer', 'uint', 'pointer'], GetAbi()),
                WindowsDeleteString: new NativeFunction(FindHiddenExport("combase.dll", "WindowsDeleteString"), 'uint', ['pointer'], GetAbi()),
                WindowsGetStringRawBuffer: new NativeFunction(FindHiddenExport("combase.dll", "WindowsGetStringRawBuffer"), 'pointer', ['pointer', 'pointer'], GetAbi()),
            };
            this.alloc = function (str) {
                var ret = new Struct({ 'value': 'pointer' });
                COM.ThrowIfFailed(ComBase.WindowsCreateString(Memory.allocUtf16String(str), str.length, ret.Get()));
                return ret.value;
            }
            this.read = function (hstring) { return Memory.readUtf16String(ComBase.WindowsGetStringRawBuffer(hstring, NULL)); }
            this.free = function (hstring) { return ComBase.WindowsDeleteString(hstring); }
        }
    }

    var _COM = null;
    Object.defineProperty(global, "COM", { get: function () {
        if (_COM == null) { _COM = new CreateCOM(); }
        return _COM;
    }});
    function CreateCOM() {
        var GUID = Win32.GUID;

        var HRESULTMap = [
            ['E_ABORT', 0x80004004],
            ['E_ACCESSDENIED', 0x80070005],
            ['E_FAIL', 0x80004005],
            ['E_HANDLE', 0x80070006],
            ['E_INVALIDARG', 0x80070057],
            ['E_NOINTERFACE', 0x80004002],
            ['E_NOTIMPL', 0x80004001],
            ['E_OUTOFMEMORY', 0x8007000E],
            ['E_POINTER', 0x80004003],
            ['E_UNEXPECTED', 0x8000FFFF],
        ];

        // COM global constants
        var S_OK = 0;
        var S_FALSE = 1;
        var E_NOINTERFACE = 0x80004002;

        // COM Flow control
        function Succeeded(hr) {
            var ret = parseInt(hr, 10);
            return ret == S_OK || ret == S_FALSE;
        }
        function Failed(hr) { return !Succeeded(hr); }
        function ThrowIfFailed(hr) {
            if (Failed(hr)) {
                var friendlyStr = "";
                for (var i = 0; i < HRESULTMap.length; ++i) {
                    if (hr == HRESULTMap[i][1]) {
                        friendlyStr = " " + HRESULTMap[i][0];
                        break;
                    }
                }
                throw new Error('COMException 0x' + hr.toString(16) + friendlyStr);
            }
            return hr;
        }

        var IUnknown = {
            IID: GUID.alloc("00000000-0000-0000-C000-000000000046"),
            QueryInterface: [0, ['pointer', 'pointer']],
            AddRef: [1, []],
            Release: [2, []],
        };

        var IInspectable = {
            IID: GUID.alloc("AF86E2E0-B12D-4c6a-9C5A-D7AA65101E90"),
            // IUnknown
            QueryInterface: IUnknown.QueryInterface,
            AddRef: IUnknown.AddRef,
            Release: IUnknown.Release,
            // IInspectable
            GetIids: [3, ['pointer', 'pointer']],
            GetRuntimeClassName: [4, ['pointer']],
            GetTrustLevel: [5, ['pointer']],
        };

        function ComInterface(baseInterface, methods, iid_str) {
            for (var method in methods) {
                this[method] = methods[method];
            }

            this.IID = GUID.alloc(iid_str);
            if (baseInterface.IID == IInspectable.IID) {
                this.IInspectable = true;
            }
        }

        var IAgileObject = new ComInterface(IUnknown, {
            // Marker interface, it has no methods.
        }, "94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90");

        function iunknown_ptr(address, idl) {
            function vtable_wrapper(address) {
                var getMethodAddress = function (ordinal) {
                    var addr = Memory.readPointer(address); // vtbl
                    return Memory.readPointer(addr.add(Process.pointerSize * ordinal)); // pointer to func
                }
                this.GetMethodAddress = getMethodAddress;

                this.Invoke = function (ordinal, paramTypes, params, tagName) {
                    if (address == 0x0) { throw Error("Can't invoke method on null pointer"); }
                    //console.log("com_ptr(" + address + ")->" + tagName + " (" + params + ")");
                    // Add 'this' as first argument
                    var localTypes = paramTypes.slice();
                    localTypes.unshift('pointer');
                    var localParams = params.slice();
                    localParams.unshift(address);
                    return METHOD_APPLY_SHIM(new NativeFunction(getMethodAddress(ordinal), 'uint', localTypes, GetAbi()), localParams);
                };
            }
            var vtable = new vtable_wrapper(address);

            var calculateOrdinal = function (ordinal) {
                var countMethods = function (idl) {
                    var count = -1; // IID will be the only non-method property.
                    for (var method in idl) { ++count; }
                    return count;
                }
                return ordinal + (idl.IInspectable ? countMethods(IInspectable) : countMethods(IUnknown));
            };

            this.InvokeMethod = function (ordinal, paramTypes, params, tagName) {
                return vtable.Invoke(calculateOrdinal(ordinal), paramTypes, params, tagName);
            }
            this.GetMethodAddress = function (ordinal) {
                return vtable.GetMethodAddress(calculateOrdinal(ordinal));
            }

            // IUnknown
            this.QueryInterface = function (iid, ppv) { return vtable.Invoke(IUnknown.QueryInterface[0], IUnknown.QueryInterface[1], [iid, ppv], "QueryInterface"); };
            this.AddRef = function () { return vtable.Invoke(IUnknown.AddRef[0], IUnknown.AddRef[1], [], "AddRef"); };
            this.Release = function () { return vtable.Invoke(IUnknown.Release[0], IUnknown.Release[1], [], "Release"); };

            // IInspectable
            this.GetIids = function () {
                var size_ptr = new Struct({ 'value': 'pointer' });
                var iids_ptr = new Struct({ 'value': 'pointer' });
                ThrowIfFailed(vtable.Invoke(IInspectable.GetIids[0], IInspectable.GetIids[1], [size_ptr.Get(), iids_ptr.Get()], "GetIids"));
                var size = Memory.readUInt(size_ptr.value);
                var ret = [];
                for (var i = 0; i < size; ++i) {
                    ret.push(GUID.read(iids_ptr.value.add(i * Process.pointerSize)));
                }
                return ret;
            };
            this.GetRuntimeClassName = function () {
                var class_name_ptr = new Struct({ 'value': 'pointer' });
                if (Succeeded(vtable.Invoke(IInspectable.GetRuntimeClassName[0], IInspectable.GetRuntimeClassName[1], [class_name_ptr.Get()], "GetRuntimeClassName"))) {
                    return WinRT.HSTRING.read(class_name_ptr.value);
                } else {
                    return "[GetRuntimeClassName Failed]";
                }
            }
            this.GetTrustLevel = function () {
                var trust_ptr = new Struct({ 'value': 'pointer' });
                ThrowIfFailed(vtable.Invoke(IInspectable.GetTrustLevel[0], IInspectable.GetTrustLevel[1], [trust_ptr.Get()], "GetTrustLevel"));
                var trust_level = Memory.readUInt(trust_ptr.value);
                return trust_level == 0 ? "BaseTrust" : trust_level == 1 ? "PartialTrust" : "FullTrust";
            }
        }

        function com_ptr(idl) {
            var _ptr = new Struct({ 'value': 'pointer' }); // the real reference is here

            var resolve_ptr = function () { return new iunknown_ptr(_ptr.value, idl); }
            this.$ComPtr_Invoke = function (methodDfn, args) { return resolve_ptr().InvokeMethod(methodDfn[0], methodDfn[1], args, "$ComPtr_Invoke"); };
            this.$ComPtr_GetMethodAddress = function (methodDfn) { return resolve_ptr().GetMethodAddress(methodDfn[0]); }
            this.Release = function () { return resolve_ptr().Release(); }
            this.GetAddressOf = function () { return _ptr.Get(); }
            this.Get = function () { return _ptr.value; }
            this.As = function (otherIdl) {
                var ret = new com_ptr(otherIdl);
                ThrowIfFailed(resolve_ptr().QueryInterface(otherIdl.IID, ret.GetAddressOf()));
                return ret;
            }
            this.Attach = function (addr) {
                _ptr.value = addr;
                return this;
            }

            this.toString = function () {
                var iinspectable_extra = idl == IInspectable && (_ptr.value != 0x0) ?
                    " " + resolve_ptr().GetRuntimeClassName() + " IInspectable" + resolve_ptr().GetIids() + " " + resolve_ptr().GetTrustLevel() : "";
                return "[com_ptr " + _ptr.Get() + iinspectable_extra + "]";
            }

            var self = this;
            var CreateMethod = function (methodName) {
                var removed_methods = ["QueryInterface", "AddRef", "Release", "GetIids", "GetRuntimeClassName", "GetTrustLevel", "IID", "IInspectable"];
                for (var i = 0; i < removed_methods.length; ++i) {
                    if (removed_methods[i] == method) {
                        return;
                    }
                }

                var MethodProc = function () {
                    return resolve_ptr().InvokeMethod(idl[methodName][0], idl[methodName][1], Array.prototype.slice.call(arguments, 0), methodName, idl[methodName][2]);
                }
                MethodProc.GetAddressOf = function () {
                    return resolve_ptr().GetMethodAddress(idl[methodName][0]);
                }
                self[methodName] = MethodProc;
            }

            // Add IDL methods onto this object.
            for (var method in idl) { CreateMethod(method); }
        }

        function RuntimeComObject(iid) {
            var vtable_entries = [];
            var iids = [IUnknown.IID, IAgileObject.IID, iid];
            var refCount = 1;

            this.AddEntry = function (callback, retType, paramTypes) {
                vtable_entries.push(new NativeCallback(callback, retType, paramTypes, GetAbi()));
            };

            this.AddIid = function (iid) { iids.push(iid); };

            this.GetAddress = function () {
                var vTable = Memory.alloc(Process.pointerSize * vtable_entries.length);

                for (var i = 0; i < vtable_entries.length; ++i) {
                    var vTableEntry = vTable.add(Process.pointerSize * i);
                    Memory.writePointer(vTableEntry, vtable_entries[i]);
                }

                var com_object_pointer = new Struct({ 'value': 'pointer' });
                com_object_pointer.value = vTable;
                return com_object_pointer.Get();
            };

            // QueryInterface
            this.AddEntry(function (this_ptr, riid, ppv) {
                var find_guid = GUID.read(riid);
                for (var i = 0; i < iids.length; ++i) {
                    if (GUID.read(iids[i]) == find_guid) {
                        ++refCount;
                        Memory.writePointer(ppv, this_ptr);
                        //console.log("RuntimeComObject QueryInterface S_OK: " + find_guid);
                        return S_OK;
                    }
                }
                console.error("RuntimeComObject QueryInterface E_NOINTERFACE: " + find_guid);
                return E_NOINTERFACE;
            }, 'uint', ['pointer', 'pointer', 'pointer']);
            // AddRef
            this.AddEntry(function (this_ptr) { return ++refCount; }, 'ulong', ['pointer']);
            // Release
            this.AddEntry(function (this_ptr) { return --refCount; }, 'ulong', ['pointer']);
        }

        var Ole32 = {
            CoInitializeEx: new NativeFunction(Module.findExportByName("Ole32.dll", "CoInitializeEx"), 'uint', ['pointer', 'uint'], GetAbi()),
            CoCreateInstance: new NativeFunction(Module.findExportByName("Ole32.dll", "CoCreateInstance"), 'uint', ['pointer', 'pointer', 'uint', 'pointer', 'pointer'], GetAbi()),
        };

        this.S_OK = S_OK;
        this.ApartmentType = { // COINIT
            STA: 0x2,
            MTA: 0x0
        };
        this.ClassContext = { // CLSCTX
            InProc: 0x1,
            Local: 0x4,
        };
        this.IUnknown = IUnknown;
        this.IInspectable = IInspectable;

        this.Pointer = com_ptr;
        this.Interface = ComInterface;
        this.RuntimeObject = RuntimeComObject;
        this.Succeeded = Succeeded;
        this.Failed = Failed;
        this.ThrowIfFailed = ThrowIfFailed;
        this.CreateInstance = function (clsid, clsctx, idl) {
            var ret = new com_ptr(idl);
            ThrowIfFailed(Ole32.CoCreateInstance(clsid, NULL, clsctx, idl.IID, ret.GetAddressOf()));
            return ret;
        }
        this.Initialize = function (apartment) {
            ThrowIfFailed(Ole32.CoInitializeEx(NULL, apartment));
        }

        var _BSTR = null;
        Object.defineProperty(this, "BSTR", {
            get: function () {
                if (_BSTR == null) { _BSTR = new CreateBSTR(); }
                return _BSTR;
            }
        });
        function CreateBSTR() {
            var OleAut32 = {
                SysAllocString: new NativeFunction(Module.findExportByName("OleAut32.dll", "SysAllocString"), 'pointer', ['pointer'], GetAbi()),
                SysFreeString: new NativeFunction(Module.findExportByName("OleAut32.dll", "SysFreeString"), 'void', ['pointer'], GetAbi()),
            };
            this.alloc = function (str) { return OleAut32.SysAllocString(Memory.allocUtf16String(str)); }
            this.read = function (bstr_ptr) { return Memory.readUtf16String(str); }
            this.free = function (bstr_ptr) { OleAut32.SysFreeString(bstr_ptr); }
        }
    }
})();
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
// Add some custom types. [size, readFunc, writeFunc]
Win32.TypeMap['pwstr'] = [Process.pointerSize, 
    function(addr) { return Memory.readUtf16String(Memory.readPointer(addr)); },     
    function(addr, newValue) { 
        var stringRef = Memory.allocUtf16String(newValue);
        Memory.writePointer(addr, stringRef);
        return stringRef; // tied to object lifetime.
    }
];
Win32.TypeMap['guid'] = [16, 
    Win32.GUID.read, 
    function (addr, newValue) { Memory.copy(addr, Win32.GUID.alloc(newValue), 16); }
];

var PROPKEY = {
    fmtid: 'guid',
    pid: 'ulong'
}

var PKEY_AppUserModel_Id = new Win32.Struct(PROPKEY);
PKEY_AppUserModel_Id.fmtid = "9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3";
PKEY_AppUserModel_Id.pid = 5;

var Shell32 = {
    SHGetPropertyStoreForWindow: new NativeFunction(Module.findExportByName("shell32.dll", "SHGetPropertyStoreForWindow"), 'uint', ['int','pointer', 'pointer']),
};

var VT_LPWSTR = 31;
var PROPVARIANT = {
    vt: 'uint16',
    reserved1: 'uchar',
    reserved2: 'uchar',
    reserved3: 'ulong',
    union: {
        intVal: 'int',
        pwszVal: 'pwstr',
    },
    extra: 'ulong'
};

var IPropertyStore = new COM.Interface(COM.IUnknown, {
    // HRESULT SetValue([in] REFPROPERTYKEY key, [in] REFPROPVARIANT propvar);
    SetValue: [3, ['pointer', 'pointer']],
}, "886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");

function SetAppIdForWindow(hwnd, appId) {
    var propStore = new COM.Pointer(IPropertyStore);
    COM.ThrowIfFailed(Shell32.SHGetPropertyStoreForWindow(hwnd, IPropertyStore.IID, propStore.GetAddressOf()));

    var propVar = new Win32.Struct(PROPVARIANT);
    propVar.vt = VT_LPWSTR;
    propVar.pwszVal = appId;
    console.log(propVar.pwszVal);
    console.log(propVar.intVal);

    COM.ThrowIfFailed(propStore.SetValue(PKEY_AppUserModel_Id.Get(), propVar.Get()));
}

CLR.Init();
CLR.AddNamespace("System");

setTimeout(function() {
    function CheckForMainWindow() {
        var hwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle.value;
        if (hwnd > 0) {
            SetAppIdForWindow(hwnd, "Notepad.2");
        } else {
            setTimeout(CheckForMainWindow, 1);
        }
    }
    CheckForMainWindow();
},5000);