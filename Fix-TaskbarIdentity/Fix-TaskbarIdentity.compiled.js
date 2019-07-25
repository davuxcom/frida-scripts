(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict"; // OBJECTIVE: 
// Wait 5 seconds
// Use .net to get an hwnd for our process
// Set the window property store AppId on that hwnd
// Taskbar will recognize the change and show a unique button for this window

const Win32 = require('../common/win32');

const Struct = require('../common/struct');

const GUID = require('../common/guid');

const COM = require('../common/com');

const CLR = require('../common/dotnet');

const System = CLR.GetNamespace("System"); // Add some custom types. [size, readFunc, writeFunc]

Struct.TypeMap['pwstr'] = [Process.pointerSize, function (addr) {
  return Memory.readUtf16String(Memory.readPointer(addr));
}, function (addr, newValue) {
  var stringRef = Memory.allocUtf16String(newValue);
  Memory.writePointer(addr, stringRef);
  return stringRef; // tied to object lifetime.
}];
Struct.TypeMap['guid'] = [16, GUID.read, function (addr, newValue) {
  Memory.copy(addr, GUID.alloc(newValue), 16);
}]; // API from windows headers

var PROPKEY = {
  fmtid: 'guid',
  pid: 'ulong'
};
var PKEY_AppUserModel_Id = new Struct(PROPKEY);
PKEY_AppUserModel_Id.fmtid = "9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3";
PKEY_AppUserModel_Id.pid = 5;
var Shell32 = {
  SHGetPropertyStoreForWindow: new NativeFunction(Module.findExportByName("shell32.dll", "SHGetPropertyStoreForWindow"), 'uint', ['int', 'pointer', 'pointer'])
};
var VT_LPWSTR = 31;
var PROPVARIANT = {
  vt: 'uint16',
  reserved1: 'uchar',
  reserved2: 'uchar',
  reserved3: 'ulong',
  union: {
    intVal: 'int',
    pwszVal: 'pwstr'
  },
  extra: 'ulong'
};
var IPropertyStore = new COM.Interface(COM.IUnknown, {
  // HRESULT SetValue([in] REFPROPERTYKEY key, [in] REFPROPVARIANT propvar);
  SetValue: [3, ['pointer', 'pointer']]
}, "886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");

function SetAppIdForWindow(hwnd, appId) {
  var propStore = new COM.Pointer(IPropertyStore);
  COM.ThrowIfFailed(Shell32.SHGetPropertyStoreForWindow(hwnd, IPropertyStore.IID, propStore.GetAddressOf()));
  var propVar = new Struct(PROPVARIANT);
  propVar.vt = VT_LPWSTR;
  propVar.pwszVal = appId;
  console.log(propVar.pwszVal);
  console.log(propVar.intVal);
  COM.ThrowIfFailed(propStore.SetValue(PKEY_AppUserModel_Id.Get(), propVar.Get()));
}

setTimeout(function () {
  function CheckForMainWindow() {
    var hwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle.value;

    if (hwnd > 0) {
      SetAppIdForWindow(hwnd, "Notepad.2");
    } else {
      setTimeout(CheckForMainWindow, 1);
    }
  }

  CheckForMainWindow();
}, 5000);

},{"../common/com":2,"../common/dotnet":3,"../common/guid":4,"../common/struct":5,"../common/win32":6}],2:[function(require,module,exports){
const Struct = require('./struct');

const GUID = require('./guid');

const Win32 = require('./win32');

var HRESULTMap = [['E_ABORT', 0x80004004], ['E_ACCESSDENIED', 0x80070005], ['E_FAIL', 0x80004005], ['E_HANDLE', 0x80070006], ['E_INVALIDARG', 0x80070057], ['E_NOINTERFACE', 0x80004002], ['E_NOTIMPL', 0x80004001], ['E_OUTOFMEMORY', 0x8007000E], ['E_POINTER', 0x80004003], ['E_UNEXPECTED', 0x8000FFFF]]; // COM global constants

var S_OK = 0;
var S_FALSE = 1;
var E_NOINTERFACE = 0x80004002; // COM Flow control

function Succeeded(hr) {
  var ret = parseInt(hr, 10);
  return ret == S_OK || ret == S_FALSE;
}

function Failed(hr) {
  return !Succeeded(hr);
}

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
  Release: [2, []]
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
  GetTrustLevel: [5, ['pointer']]
};
var IAgileObject = new ComInterface(IUnknown, {// Marker interface, it has no methods.
}, "94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90");
var Ole32 = {
  CoInitializeEx: new NativeFunction(Module.findExportByName("Ole32.dll", "CoInitializeEx"), 'uint', ['pointer', 'uint'], Win32.Abi),
  CoCreateInstance: new NativeFunction(Module.findExportByName("Ole32.dll", "CoCreateInstance"), 'uint', ['pointer', 'pointer', 'uint', 'pointer', 'pointer'], Win32.Abi)
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

function iunknown_ptr(address, idl) {
  function vtable_wrapper(address) {
    var getMethodAddress = function (ordinal) {
      var addr = Memory.readPointer(address); // vtbl

      return Memory.readPointer(addr.add(Process.pointerSize * ordinal)); // pointer to func
    };

    this.GetMethodAddress = getMethodAddress;

    this.Invoke = function (ordinal, paramTypes, params, tagName) {
      if (address == 0x0) {
        throw Error("Can't invoke method on null pointer");
      } //console.log("com_ptr(" + address + ")->" + tagName + " (" + params + ")");
      // Add 'this' as first argument


      var localTypes = paramTypes.slice();
      localTypes.unshift('pointer');
      var localParams = params.slice();
      localParams.unshift(address);
      var fn = new NativeFunction(getMethodAddress(ordinal), 'uint', localTypes, Win32.Abi);
      return fn.apply(fn, localParams);
    };
  }

  var vtable = new vtable_wrapper(address);

  var calculateOrdinal = function (ordinal) {
    var countMethods = function (idl) {
      var count = -1; // IID will be the only non-method property.

      for (var method in idl) {
        ++count;
      }

      return count;
    };

    return ordinal + (idl.IInspectable ? countMethods(IInspectable) : countMethods(IUnknown));
  };

  this.InvokeMethod = function (ordinal, paramTypes, params, tagName) {
    return vtable.Invoke(calculateOrdinal(ordinal), paramTypes, params, tagName);
  };

  this.GetMethodAddress = function (ordinal) {
    return vtable.GetMethodAddress(calculateOrdinal(ordinal));
  }; // IUnknown


  this.QueryInterface = function (iid, ppv) {
    return vtable.Invoke(IUnknown.QueryInterface[0], IUnknown.QueryInterface[1], [iid, ppv], "QueryInterface");
  };

  this.AddRef = function () {
    return vtable.Invoke(IUnknown.AddRef[0], IUnknown.AddRef[1], [], "AddRef");
  };

  this.Release = function () {
    return vtable.Invoke(IUnknown.Release[0], IUnknown.Release[1], [], "Release");
  }; // IInspectable


  this.GetIids = function () {
    var size_ptr = new Struct({
      'value': 'pointer'
    });
    var iids_ptr = new Struct({
      'value': 'pointer'
    });
    ThrowIfFailed(vtable.Invoke(IInspectable.GetIids[0], IInspectable.GetIids[1], [size_ptr.Get(), iids_ptr.Get()], "GetIids"));
    var size = Memory.readUInt(size_ptr.value);
    var ret = [];

    for (var i = 0; i < size; ++i) {
      ret.push(GUID.read(iids_ptr.value.add(i * Process.pointerSize)));
    }

    return ret;
  };

  this.GetRuntimeClassName = function () {
    var class_name_ptr = new Struct({
      'value': 'pointer'
    });

    if (Succeeded(vtable.Invoke(IInspectable.GetRuntimeClassName[0], IInspectable.GetRuntimeClassName[1], [class_name_ptr.Get()], "GetRuntimeClassName"))) {
      return WinRT.HSTRING.read(class_name_ptr.value);
    } else {
      return "[GetRuntimeClassName Failed]";
    }
  };

  this.GetTrustLevel = function () {
    var trust_ptr = new Struct({
      'value': 'pointer'
    });
    ThrowIfFailed(vtable.Invoke(IInspectable.GetTrustLevel[0], IInspectable.GetTrustLevel[1], [trust_ptr.Get()], "GetTrustLevel"));
    var trust_level = Memory.readUInt(trust_ptr.value);
    return trust_level == 0 ? "BaseTrust" : trust_level == 1 ? "PartialTrust" : "FullTrust";
  };
}

function com_ptr(idl) {
  var _ptr = new Struct({
    'value': 'pointer'
  }); // the real reference is here


  var resolve_ptr = function () {
    return new iunknown_ptr(_ptr.value, idl);
  };

  this.$ComPtr_Invoke = function (methodDfn, args) {
    return resolve_ptr().InvokeMethod(methodDfn[0], methodDfn[1], args, "$ComPtr_Invoke");
  };

  this.$ComPtr_GetMethodAddress = function (methodDfn) {
    return resolve_ptr().GetMethodAddress(methodDfn[0]);
  };

  this.Release = function () {
    return resolve_ptr().Release();
  };

  this.GetAddressOf = function () {
    return _ptr.Get();
  };

  this.Get = function () {
    return _ptr.value;
  };

  this.As = function (otherIdl) {
    var ret = new com_ptr(otherIdl);
    ThrowIfFailed(resolve_ptr().QueryInterface(otherIdl.IID, ret.GetAddressOf()));
    return ret;
  };

  this.Attach = function (addr) {
    _ptr.value = addr;
    return this;
  };

  this.toString = function () {
    var iinspectable_extra = idl == IInspectable && _ptr.value != 0x0 ? " " + resolve_ptr().GetRuntimeClassName() + " IInspectable" + resolve_ptr().GetIids() + " " + resolve_ptr().GetTrustLevel() : "";
    return "[com_ptr " + _ptr.Get() + iinspectable_extra + "]";
  };

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
    };

    MethodProc.GetAddressOf = function () {
      return resolve_ptr().GetMethodAddress(idl[methodName][0]);
    };

    self[methodName] = MethodProc;
  }; // Add IDL methods onto this object.


  for (var method in idl) {
    CreateMethod(method);
  }
}

function RuntimeComObject(iid) {
  var vtable_entries = [];
  var iids = [IUnknown.IID, IAgileObject.IID, iid];
  var refCount = 1;

  this.AddEntry = function (callback, retType, paramTypes) {
    vtable_entries.push(new NativeCallback(callback, retType, paramTypes, Win32.Abi));
  };

  this.AddIid = function (iid) {
    iids.push(iid);
  };

  this.GetAddress = function () {
    var vTable = Memory.alloc(Process.pointerSize * vtable_entries.length);

    for (var i = 0; i < vtable_entries.length; ++i) {
      var vTableEntry = vTable.add(Process.pointerSize * i);
      Memory.writePointer(vTableEntry, vtable_entries[i]);
    }

    var com_object_pointer = new Struct({
      'value': 'pointer'
    });
    com_object_pointer.value = vTable;
    return com_object_pointer.Get();
  }; // QueryInterface


  this.AddEntry(function (this_ptr, riid, ppv) {
    var find_guid = GUID.read(riid);

    for (var i = 0; i < iids.length; ++i) {
      if (GUID.read(iids[i]) == find_guid) {
        ++refCount;
        Memory.writePointer(ppv, this_ptr); //console.log("RuntimeComObject QueryInterface S_OK: " + find_guid);

        return S_OK;
      }
    }

    console.error("RuntimeComObject QueryInterface E_NOINTERFACE: " + find_guid);
    return E_NOINTERFACE;
  }, 'uint', ['pointer', 'pointer', 'pointer']); // AddRef

  this.AddEntry(function (this_ptr) {
    return ++refCount;
  }, 'ulong', ['pointer']); // Release

  this.AddEntry(function (this_ptr) {
    return --refCount;
  }, 'ulong', ['pointer']);
}

module.exports = {
  S_OK: S_OK,
  ApartmentType: {
    // COINIT
    STA: 0x2,
    MTA: 0x0
  },
  ClassContext: {
    // CLSCTX
    InProc: 0x1,
    Local: 0x4
  },
  IUnknown: IUnknown,
  IInspectable: IInspectable,
  Pointer: com_ptr,
  Interface: ComInterface,
  RuntimeObject: RuntimeComObject,
  Succeeded: Succeeded,
  Failed: Failed,
  ThrowIfFailed: ThrowIfFailed,
  CreateInstance: function (clsid, clsctx, idl) {
    var ret = new com_ptr(idl);
    ThrowIfFailed(Ole32.CoCreateInstance(clsid, NULL, clsctx, idl.IID, ret.GetAddressOf()));
    return ret;
  },
  Initialize: function (apartment) {
    ThrowIfFailed(Ole32.CoInitializeEx(NULL, apartment));
  }
};

},{"./guid":4,"./struct":5,"./win32":6}],3:[function(require,module,exports){
(function (global){
"use strict"; // GOAL: Using the below DotNetBridge, build JS objects to represent a root namespace and all subsequent types.
//
// Known limitations: We can't create a new type unless we have an assembly to load (which can be done)

const Win32 = require('./win32');

const Struct = require('./struct');

const GUID = require('./guid');

const COM = require('./com'); // InProc component that is expected to be found in the registry.


var CLSID_DotNetBridge = GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
var IDotNetBridge = new COM.Interface(COM.IUnknown, {
  CreateObject: [0, ['pointer', 'pointer', 'pointer']],
  DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
  CreateDelegate: [2, ['pointer', 'pointer', 'pointer']],
  InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
  ReleaseObject: [4, ['pointer', 'pointer']],
  DescribeNamespace: [5, ['pointer', 'pointer']]
}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

function ResolveResult(result) {
  var ret = JSON.parse(Memory.readUtf16String(result));

  if (ret && ret.__ERROR) {
    throw Error(ret.Message + "\n" + ret.Stack + "\n");
  } else if (ret && ret.__OBJECT) {
    ret = new ClrObjectWrapper(ret);
  }

  return ret;
}

function ResolveArgs(params) {
  if (typeof params === 'undefined') {
    params = [];
  }

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
  } else {
    throw new Error("Bad args " + params);
  }
}

function DotNetBridge() {
  console.log("[*] Creating DotNetBridge");
  var bridge = COM.CreateInstance(CLSID_DotNetBridge, COM.ClassContext.InProc, IDotNetBridge);

  function DoCall(method) {
    var args = [];

    for (var i = 1; i < arguments.length; ++i) {
      args[i - 1] = arguments[i];
    }

    var outPtr = new Struct({
      'value': 'pointer'
    });
    args[args.length] = outPtr.Get();
    COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));
    return outPtr.value;
  }

  this.CreateObject = function (typeInfo, args) {
    if (typeInfo.IsDelegate) {
      return ResolveResult(DoCall("CreateDelegate", Memory.allocUtf16String(typeInfo.TypeName), JsonDelegate(args)));
    } else {
      return ResolveResult(DoCall("CreateObject", Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(ResolveArgs(args))));
    }
  };

  this.DescribeObject = function (typeName, objHandle) {
    if (typeof typeName === "string") {
      typeName = Memory.allocUtf16String(typeName);
      objHandle = NULL;
    } else {
      objHandle = Memory.allocUtf16String(JSON.stringify(objHandle));
      typeName = NULL;
    }

    return ResolveResult(DoCall("DescribeObject", typeName, objHandle));
  };

  this.ReleaseObject = function (objHandle) {
    return ResolveResult(DoCall("ReleaseObject", Memory.allocUtf16String(JSON.stringify(objHandle))));
  };

  this.DescribeNamespace = function (namespaceName) {
    return ResolveResult(DoCall("DescribeNamespace", Memory.allocUtf16String(namespaceName)));
  };

  this.InvokeMethod = function (objHandle, typeInfo, method, args, genericTypes, returnBoxed) {
    return ResolveResult(DoCall("InvokeMethod", objHandle == null ? NULL : Memory.allocUtf16String(JSON.stringify(objHandle)), Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(method), Memory.allocUtf16String(ResolveArgs(args)), genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL, returnBoxed ? 1 : 0));
  };
} // Ensure the bridge is a singleton, even if this script is included multiple times.


function GetBridgeInstance() {
  const CLR_BRIDGE_TAG = "$$CLRBRIDGE";
  global[CLR_BRIDGE_TAG] = CLR_BRIDGE_TAG in global ? global[CLR_BRIDGE_TAG] : new DotNetBridge();
  return global[CLR_BRIDGE_TAG];
}

const BridgeExports = GetBridgeInstance();
var all_Objects = [];
var callback_objects = [];
var saved_Objects = [];

function ExposeMethodsFromType(self, typeInfo) {
  function CreateMethod(self, method) {
    var invokeMethod = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0));
    };

    invokeMethod.Of = function () {
      var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

      for (var i = 0; i < arguments.length; ++i) {
        genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
      }

      var invokeGenericMethod = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes);
      };

      invokeGenericMethod.Box = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes, true);
      };

      return invokeGenericMethod;
    };

    invokeMethod.Box = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), null, true);
    }; // Wire get_ and set_ to a property get/set.


    if (method.Name.startsWith("get_") && method.Parameters.length == 0 || method.Name.startsWith("set_") && method.Parameters.length == 1) {
      try {
        var shortMethodName = method.Name.slice("get_".length);
        Object.defineProperty(self, shortMethodName, {
          get: function () {
            return self.$Clr_Invoke("get_" + shortMethodName, []);
          },
          set: function (newValue) {
            return self.$Clr_Invoke("set_" + shortMethodName, [newValue]);
          }
        });
      } catch (e) {// console.warn("Can't define " + shortMethodName);
        // BUG: 'MaxWorkingSet may not be redefined.'
        // We can't overwrite reserved keywords.
      }
    } else if (method.Name.startsWith("add_") && method.Parameters && method.Parameters.length == 1 || method.Name.startsWith("remove_") && method.Parameters && method.Parameters.length == 1) {
      var shortMethodName = method.Name.substring(method.Name.startsWith("add_") ? "add_".length : "remove_".length);

      if (self[shortMethodName]) {
        return;
      }

      Object.defineProperty(self, shortMethodName, {
        get: function () {
          var EventHandler = new function () {
            this.add = function (delegate) {
              self.$Clr_Invoke("add_" + shortMethodName, [delegate]);
              return delegate;
            };

            this.remove = function (delegate) {
              // token = obj += delegate ... token is delegate.toString which is JSON by convention.
              if (typeof delegate == "string") {
                delegate = new ClrObjectWrapper(JSON.parse(delegate));
              }

              return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
            }; // This makes it "" + other.toString() in the setter below when doing "handler += other"


            this.toString = function () {
              return "";
            };
          }();
          return EventHandler;
        },
        set: function (objHandle_string) {
          self.$Clr_Invoke("add_" + shortMethodName, [new ClrObjectWrapper(JSON.parse(objHandle_string))]);
        }
      });
    } else {
      self[method.Name] = invokeMethod;
    }
  }

  ;

  if (typeInfo.Methods) {
    for (var i = 0; i < typeInfo.Methods.length; ++i) {
      CreateMethod(self, typeInfo.Methods[i]);
    }
  }

  function ExposeField(self, name) {
    Object.defineProperty(self, name, {
      get: function () {
        return self.$Clr_Invoke(name, []);
      },
      set: function (value) {
        return self.$Clr_Invoke(name, [value]);
      }
    });
  }

  if (typeInfo.Fields) {
    for (var i = 0; i < typeInfo.Fields.length; ++i) {
      ExposeField(self, typeInfo.Fields[i]);
    }
  }
}

function ExposeNestedTypesFromType(self, typeInfo) {
  function CreateValue(self, name) {
    try {
      var shortName = name.replace(typeInfo.TypeName + "+", "");
      Object.defineProperty(self, shortName, {
        get: function () {
          return CreateClrTypeWrapper(name);
        }
      });
    } catch (e) {
      console.warn("Can't define " + name);
    }
  }

  ;

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

  ConstructorFunction.$Clr_TypeOf = function () {
    return GetTypeByName(typeInfo.TypeName);
  };

  ConstructorFunction.$Clr_TypeInfo = typeInfo;

  ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
    return BridgeExports.InvokeMethod(null, typeInfo, method, args, genericTypes, returnBoxed);
  };

  ConstructorFunction.toString = function () {
    return "[ClrType " + typeInfo.TypeName + "]";
  }; // Could be overwritten.


  ConstructorFunction.Of = function () {
    var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

    for (var i = 0; i < arguments.length; ++i) {
      genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
    }

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

    this.toString = function () {
      return this.ToString();
    };
  } else if (typeInfo.IsDelegate) {
    // Used in event add_/remove_ for "+=" semantics.
    this.toString = function () {
      return JSON.stringify(objHandle);
    };
  } else {
    this.toString = function () {
      return "[ClrObject " + typeInfo.TypeName + ": " + this.ToString() + "]";
    };
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

    if (type != null) {
      return type;
    }
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

    var ret = func.apply(func, args); // Pack up the result into object references

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

      return Memory.allocUtf16String(JSON.stringify(ret));
      ;
    }

    return NULL;
  }, 'pointer', ['pointer'], Win32.Abi); // If we don't do this, the GC is so quick it'll never be able to call back and AV.

  callback_objects.push(callback);
  return callback;
}

function GetNamespace(namespaceName) {
  return new function () {
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
      } catch (e) {// console.warn("couldn't define " + leafName + " on " + namespaceName + ":\n" + e);
      }
    }

    for (var i = 0; i < namespaceInfo.length; ++i) {
      CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType, function (leafName, isType, isMangled) {
        var fullLeafName = namespaceName + "." + leafName;

        if (isType) {
          if (isMangled) {
            // The problem is that we are given Func`1 and we can't be sure that Func will exist.
            // If it does, we need to use that, but if it doesn't, we need to hand back something that 
            // .Of(T) may be called on so that the generic types may still be accessed in either case.
            try {
              return CreateClrTypeWrapper(fullLeafName);
            } catch (e) {
              return CreateClrTypeWrapperFromInfo({
                TypeName: fullLeafName
              });
            }
          }

          return CreateClrTypeWrapper(fullLeafName);
        } else {
          return GetNamespace(fullLeafName);
        }
      });
    }
  }();
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
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./com":2,"./guid":4,"./struct":5,"./win32":6}],4:[function(require,module,exports){
"use strict";

const Win32 = require('./win32');

var Ole32 = {
  CLSIDFromString: new NativeFunction(Module.findExportByName("ole32.dll", "CLSIDFromString"), 'uint', ['pointer', 'pointer'], Win32.Abi),
  StringFromGUID2: new NativeFunction(Module.findExportByName("ole32.dll", "StringFromGUID2"), 'int', ['pointer', 'pointer', 'int'], Win32.Abi)
};
const GUID_SIZE_BYTES = 16;
module.exports = {
  Size: GUID_SIZE_BYTES,
  alloc: function (guid_string) {
    if (guid_string.length == 32) {
      // 6fdf6ffced7794fa407ea7b86ed9e59d
      guid_string = "{" + guid_string.substr(0, 8) + "-" + raw_guid.substr(8, 4) + "-" + raw_guid.substr(12, 4) + "-" + raw_guid.substr(16, 4) + "-" + raw_guid.substr(20) + "}";
    } else if (guid_string.length == 36) {
      // 6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d
      guid_string = "{" + guid_string + "}";
    } else if (guid_string.length == 38) {
      // {6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d}
      guid_string = guid_string;
    } else {
      throw Error("Guid is in an unexpected or invalid format.");
    }

    var guidStructPtr = Memory.alloc(GUID_SIZE_BYTES);

    if (0 != Ole32.CLSIDFromString(Memory.allocUtf16String(guid_string), guidStructPtr)) {
      throw Error("Can't convert string '" + guid_string + "' to GUID.");
    }

    return guidStructPtr;
  },
  read: function (guid_ptr) {
    var cbGuidStr = 128; // bytes

    var guidBuffer = Memory.alloc(cbGuidStr);

    if (Ole32.StringFromGUID2(guid_ptr, guidBuffer, cbGuidStr / 2
    /* wchar_t */
    ) > 0) {
      return Memory.readUtf16String(guidBuffer);
    } else {
      throw Error('Failed to parse guid');
    }
  }
};

},{"./win32":6}],5:[function(require,module,exports){
var TypeMap = {
  'pointer': [Process.pointerSize, Memory.readPointer, Memory.writePointer],
  'char': [1, Memory.readS8, Memory.writeS8],
  'uchar': [1, Memory.readU8, Memory.writeU8],
  'int8': [1, Memory.readS8, Memory.writeS8],
  'uint8': [1, Memory.readU8, Memory.writeU8],
  'int16': [2, Memory.readS16, Memory.writeS16],
  'uint16': [2, Memory.readU16, Memory.writeU16],
  'int': [4, Memory.readS32, Memory.writeS32],
  'uint': [4, Memory.readU32, Memory.writeU32],
  'int32': [4, Memory.readS32, Memory.writeS32],
  'uint32': [4, Memory.readU32, Memory.writeU32],
  'long': [4, Memory.readS32, Memory.writeS32],
  'ulong': [4, Memory.readU32, Memory.writeU32],
  'float': [4, Memory.readFloat, Memory.writeFloat],
  'double': [8, Memory.readDouble, Memory.writeDouble],
  'int64': [8, Memory.readS64, Memory.writeS64],
  'uint64': [8, Memory.readU64, Memory.writeU64]
}; // Given a set of definitions, build an object with getters/setters around base_ptr.

var Struct = function (structInfo) {
  function LookupType(stringType) {
    for (var type in TypeMap) {
      if (stringType == type) {
        return TypeMap[type];
      }
    }

    throw Error("Didn't find " + JSON.stringify(stringType) + " in TypeMap");
  }

  var setter_result_cache = {};

  function CreateGetterSetter(self, name, type, offset) {
    Object.defineProperty(self, name, {
      get: function () {
        return LookupType(type)[1](base_ptr.add(offset));
      },
      set: function (newValue) {
        setter_result_cache[name] = LookupType(type)[2](base_ptr.add(offset), newValue);
      }
    });
  }

  ;

  function SizeOfType(stringType) {
    return LookupType(stringType)[0];
  }

  var base_ptr_size = 0;

  for (var member in structInfo) {
    var member_size = 0;

    if (member == "union") {
      var union = structInfo[member];

      for (var union_member in union) {
        var union_member_type = union[union_member];
        var union_member_size = SizeOfType(union_member_type);

        if (member_size < union_member_size) {
          member_size = union_member_size;
        }

        CreateGetterSetter(this, union_member, union_member_type, base_ptr_size);
      }
    } else {
      var member_size = SizeOfType(structInfo[member]);
      CreateGetterSetter(this, member, structInfo[member], base_ptr_size);
    }

    base_ptr_size += member_size;
  }

  var base_ptr = Memory.alloc(base_ptr_size);

  this.Get = function () {
    return base_ptr;
  };

  Object.defineProperty(this, "Size", {
    get: function () {
      return base_ptr_size;
    }
  });
};

module.exports = Struct;
module.exports.TypeMap = TypeMap;

},{}],6:[function(require,module,exports){
const Struct = require('./struct');

const GUID = require('./guid');

module.exports = {
  // Microsoft APIs use stdcall on x86.
  Abi: Process.arch == 'x64' ? 'win64' : 'stdcall'
};

},{"./guid":4,"./struct":5}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJGaXgtVGFza2JhcklkZW50aXR5LmpzIiwiLi4vY29tbW9uL2NvbS5qcyIsIi4uL2NvbW1vbi9kb3RuZXQuanMiLCIuLi9jb21tb24vZ3VpZC5qcyIsIi4uL2NvbW1vbi9zdHJ1Y3QuanMiLCIuLi9jb21tb24vd2luMzIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxhLENBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsaUJBQUQsQ0FBckI7O0FBQ0EsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLGtCQUFELENBQXRCOztBQUNBLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxnQkFBRCxDQUFwQjs7QUFDQSxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsZUFBRCxDQUFuQjs7QUFDQSxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsa0JBQUQsQ0FBbkI7O0FBQ0EsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFlBQUosQ0FBaUIsUUFBakIsQ0FBZixDLENBRUE7O0FBQ0EsTUFBTSxDQUFDLE9BQVAsQ0FBZSxPQUFmLElBQTBCLENBQUMsT0FBTyxDQUFDLFdBQVQsRUFDdEIsVUFBUyxJQUFULEVBQWU7QUFBRSxTQUFPLE1BQU0sQ0FBQyxlQUFQLENBQXVCLE1BQU0sQ0FBQyxXQUFQLENBQW1CLElBQW5CLENBQXZCLENBQVA7QUFBMEQsQ0FEckQsRUFFdEIsVUFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUNyQixNQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsZ0JBQVAsQ0FBd0IsUUFBeEIsQ0FBaEI7QUFDQSxFQUFBLE1BQU0sQ0FBQyxZQUFQLENBQW9CLElBQXBCLEVBQTBCLFNBQTFCO0FBQ0EsU0FBTyxTQUFQLENBSHFCLENBR0g7QUFDckIsQ0FOcUIsQ0FBMUI7QUFRQSxNQUFNLENBQUMsT0FBUCxDQUFlLE1BQWYsSUFB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aUIsQ0FBakIsRUFBb0IsUUFBUSxDQUFDLEdBQVQsQ0FBYSxNQUFiLENBQXBCLEVBQTBDLFFBQTFDLENBQTVCO0FBQWtGO0FBRi9FLEtBQWxDO0FBSUg7O0FBQUE7O0FBRUQsV0FBUyxVQUFULENBQW9CLFVBQXBCLEVBQWdDO0FBQUUsV0FBTyxVQUFVLENBQUMsVUFBRCxDQUFWLENBQXVCLENBQXZCLENBQVA7QUFBbUM7O0FBRXJFLE1BQUksYUFBYSxHQUFHLENBQXBCOztBQUNBLE9BQUssSUFBSSxNQUFULElBQW1CLFVBQW5CLEVBQStCO0FBQzNCLFFBQUksV0FBVyxHQUFHLENBQWxCOztBQUNBLFFBQUksTUFBTSxJQUFJLE9BQWQsRUFBdUI7QUFDbkIsVUFBSSxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQUQsQ0FBdEI7O0FBQ0EsV0FBSyxJQUFJLFlBQVQsSUFBeUIsS0FBekIsRUFBZ0M7QUFDNUIsWUFBSSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsWUFBRCxDQUE3QjtBQUNBLFlBQUksaUJBQWlCLEdBQUcsVUFBVSxDQUFDLGlCQUFELENBQWxDOztBQUNBLFlBQUksV0FBVyxHQUFHLGlCQUFsQixFQUFxQztBQUFFLFVBQUEsV0FBVyxHQUFHLGlCQUFkO0FBQWtDOztBQUN6RSxRQUFBLGtCQUFrQixDQUFDLElBQUQsRUFBTyxZQUFQLEVBQXFCLGlCQUFyQixFQUF3QyxhQUF4QyxDQUFsQjtBQUNIO0FBQ0osS0FSRCxNQVFPO0FBQ0gsVUFBSSxXQUFXLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFELENBQVgsQ0FBNUI7QUFDQSxNQUFBLGtCQUFrQixDQUFDLElBQUQsRUFBTyxNQUFQLEVBQWUsVUFBVSxDQUFDLE1BQUQsQ0FBekIsRUFBbUMsYUFBbkMsQ0FBbEI7QUFDSDs7QUFDRCxJQUFBLGFBQWEsSUFBSSxXQUFqQjtBQUNIOztBQUVELE1BQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxLQUFQLENBQWEsYUFBYixDQUFmOztBQUVBLE9BQUssR0FBTCxHQUFXLFlBQVk7QUFBRSxXQUFPLFFBQVA7QUFBa0IsR0FBM0M7O0FBQ0EsRUFBQSxNQUFNLENBQUMsY0FBUCxDQUFzQixJQUF0QixFQUE0QixNQUE1QixFQUFvQztBQUFFLElBQUEsR0FBRyxFQUFFLFlBQVk7QUFBRSxhQUFPLGFBQVA7QUFBdUI7QUFBNUMsR0FBcEM7QUFDSCxDQXRDRDs7QUF3Q0EsTUFBTSxDQUFDLE9BQVAsR0FBaUIsTUFBakI7QUFDQSxNQUFNLENBQUMsT0FBUCxDQUFlLE9BQWYsR0FBeUIsT0FBekI7OztBQ3ZEQSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsVUFBRCxDQUF0Qjs7QUFDQSxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsUUFBRCxDQUFwQjs7QUFFQSxNQUFNLENBQUMsT0FBUCxHQUFpQjtBQUNiO0FBQ0EsRUFBQSxHQUFHLEVBQUUsT0FBTyxDQUFDLElBQVIsSUFBZ0IsS0FBaEIsR0FBd0IsT0FBeEIsR0FBa0M7QUFGMUIsQ0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiJ9
