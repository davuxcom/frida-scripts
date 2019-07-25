(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict"; // The goal of this set of tests is to exercise the CLR helpers to create and interact with objects through the DotNetBridge.dll.

console.log("Begin");

const localSettings = require('./local_settings');

const CLR = require('../common/DotNet');

const System = CLR.GetNamespace("System");

const CLRDebug = require('../common/DotNet-debug');

CLRDebug.EnableTraceListener(); // Wait for the background thread to start.

System.Threading.Thread.Sleep(1000);
System.Diagnostics.Trace.WriteLine("hello");

function VERIFY_IS_EQUAL(expected, actual) {
  console.log("Verify: " + expected + " " + actual);

  if (actual != expected) {
    throw Error("----- FAILED -----\nVerify Failed\nExpected: " + expected + "\nActual: " + actual);
  }
}

const asmPath = localSettings.ScriptRoot + "TestLibrary1.dll";
console.log("Loading " + asmPath);
System.Reflection.Assembly.LoadFile(asmPath);
const TestLibrary1 = CLR.GetNamespace("TestLibrary1"); // Method

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestMethod(), "TestMethod"); // Method<T>(T)

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo)(new System.IO.FileInfo("f")), "System.IO.FileInfo"); // Method<T,V>(T, V)

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder)(new System.IO.FileInfo("f"), new System.Text.StringBuilder()), "System.IO.FileInfo System.Text.StringBuilder"); // Generic+Boxed

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder).Box(new System.IO.FileInfo("f"), new System.Text.StringBuilder()).ToString(), "System.IO.FileInfo System.Text.StringBuilder"); // Static and instance fields

VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 5);
TestLibrary1.Test1.Static5 = 7;
VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 7);
var test1 = new TestLibrary1.Test1();
VERIFY_IS_EQUAL(test1.Instance5, 5);
test1.Instance5 = 4;
VERIFY_IS_EQUAL(test1.Instance5, 4); // nested classes

var nested = new TestLibrary1.Test1.NestedClass();
VERIFY_IS_EQUAL(nested.Instance5, "5");
var twiceNested = new TestLibrary1.Test1.NestedClass.TwiceNestedClass();
VERIFY_IS_EQUAL(twiceNested.Instance7, "7"); // Boxing

VERIFY_IS_EQUAL(new System.Byte.Parse.Box("10").ToString(), "10"); // Test indexer

var dict = new System.Collections.Generic.Dictionary.Of(System.String, System.String)();
dict.Add("One", "OneValue");
VERIFY_IS_EQUAL(dict.get_Item("One"), "OneValue");
dict.set_Item("Two", "NewTwo");
VERIFY_IS_EQUAL(dict.get_Item("Two"), "NewTwo"); // further dictionary sanity check

VERIFY_IS_EQUAL(dict.Keys.Count, 2);
var dict_enum = dict.Values.GetEnumerator();
dict_enum.MoveNext();
dict_enum.MoveNext();
dict_enum.MoveNext();
VERIFY_IS_EQUAL(dict_enum.Current, null); // Test property

var p = new System.Diagnostics.ProcessStartInfo();
p.Arguments = "testargs";
VERIFY_IS_EQUAL(p.Arguments, "testargs"); // Delegates
// Action

var didAct = false;
var act = new System.Action(function () {
  didAct = true;
});
VERIFY_IS_EQUAL(act.Invoke() ? didAct : didAct, true);
didAct = false;
var act = new System.Action.Of(System.Boolean)(function (b) {
  didAct = true;
});
VERIFY_IS_EQUAL(act.Invoke(true) ? didAct : didAct, true); // Func<String,bool>

var fn = new System.Func.Of(System.String, System.Boolean)(function (str) {
  return true;
});
VERIFY_IS_EQUAL(fn.Invoke("foo"), true); // Func<bool,String>

var fn2 = new System.Func.Of(System.Boolean, System.String)(function (str) {
  return "foo";
});
VERIFY_IS_EQUAL(fn2.Invoke(true), "foo"); // Func<String, FileInfo>

var fn3 = new System.Func.Of(System.String, System.IO.FileInfo)(function (str) {
  return new System.IO.FileInfo(str);
});
VERIFY_IS_EQUAL(fn3.Invoke("file_test.txt").Name, "file_test.txt"); // Func<FileInfo, String>

var fn4 = new System.Func.Of(System.IO.FileInfo, System.String)(function (fi) {
  return fi.Name;
});
VERIFY_IS_EQUAL(fn4.Invoke(System.IO.FileInfo("file_test2.txt")), "file_test2.txt"); // Events
// Register

var asmLoaded = false;
var eventToken = System.AppDomain.CurrentDomain.AssemblyLoad += new System.AssemblyLoadEventHandler(function (s, e) {
  asmLoaded = true;
});
System.Reflection.Assembly.LoadWithPartialName("PresentationFramework");
VERIFY_IS_EQUAL(asmLoaded, true); // Unregister

System.AppDomain.CurrentDomain.AssemblyLoad.remove(eventToken);
asmLoaded = false;
System.Reflection.Assembly.LoadWithPartialName("System.Windows.Forms");
VERIFY_IS_EQUAL(asmLoaded, false); // will have generated loads
// Scenario test: thread

var apt = null;
var uiThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
  apt = System.Threading.Thread.CurrentThread.ApartmentState;
  System.Threading.Thread.Sleep(500);
}));
uiThread.SetApartmentState(System.Threading.ApartmentState.STA);
uiThread.Start();
uiThread.Join();
VERIFY_IS_EQUAL(apt, "STA");
VERIFY_IS_EQUAL(System.Threading.ApartmentState.STA, "STA"); // Verify that System.Byte is auto-casted to an object instance (i.e. implicit typeof())

var arr = System.Array.CreateInstance(System.Byte, 10); // Verify that a boxed value can be used for byte, since otherwise we fail to downcast from int.

arr.SetValue(System.Byte.Parse.Box("10"), 0);
var Registry = CLR.GetNamespace("Microsoft").Win32.Registry; // Field

var sn = Registry.CurrentUser.OpenSubKey("Software").GetSubKeyNames(); // Ref param

var i = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestRef(i);
VERIFY_IS_EQUAL(i.ToString(), 10); // out param

var io = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestOut(io);
VERIFY_IS_EQUAL(io.ToString(), 10); // verify pinning

var io = System.Int32.Parse.Box("5");
CLR.Pin(io);
console.log("GC: " + CLR.Prune());
var objectNotFound = false;

try {
  i.ToString();
} catch (e) {
  objectNotFound = true;
}

io.ToString();
VERIFY_IS_EQUAL(objectNotFound, true);
console.log("####################################");
console.log("####################################");
console.log("             SUCCESS");
console.log("####################################");
console.log("####################################");
console.log("[*] Unloading...");
System.Threading.Thread.Sleep(1000);
System.Diagnostics.Process.GetCurrentProcess().Kill();

},{"../common/DotNet":4,"../common/DotNet-debug":3,"./local_settings":2}],2:[function(require,module,exports){
module.exports={ScriptRoot: "C:/git/frida-scripts/Test-DotNetBridge/"} 

},{}],3:[function(require,module,exports){
"use strict"; // Simple solution to getting output from System.Diagnostics.Trace.WriteLine.

const CLR = require('./dotnet');

const System = CLR.GetNamespace("System");
module.exports = {
  EnableTraceListener: function () {
    var tracingThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
      var traceBuffer = System.Array.CreateInstance(System.Byte.$Clr_TypeOf(), 1024 * 1024 * 1024); // TODO: can't threadsafe reset tho

      CLR.Pin(traceBuffer);
      var write_ms = new System.IO.MemoryStream(traceBuffer, true);
      CLR.Pin(write_ms);
      System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(write_ms)); // ThreadProc

      var last_write = 0;

      while (true) {
        System.Diagnostics.Trace.Flush();
        var newLength = write_ms.Position;

        if (last_write != newLength) {
          var line = System.Text.Encoding.UTF8.GetString(traceBuffer, last_write, newLength - last_write);
          last_write = newLength;
          var spl = line.split("\n");

          for (var lx in spl) {
            if (spl[lx]) {
              console.log("DotNet: " + spl[lx].trim());
            }
          }
        }

        System.Threading.Thread.Sleep(500);
      }
    }));
    tracingThread.Start();
  }
};

},{"./dotnet":6}],4:[function(require,module,exports){
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

},{"./com":5,"./guid":7,"./struct":8,"./win32":9}],5:[function(require,module,exports){
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

},{"./guid":7,"./struct":8,"./win32":9}],6:[function(require,module,exports){
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

},{"./com":5,"./guid":7,"./struct":8,"./win32":9}],7:[function(require,module,exports){
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

},{"./win32":9}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
const Struct = require('./struct');

const GUID = require('./guid');

module.exports = {
  // Microsoft APIs use stdcall on x86.
  Abi: Process.arch == 'x64' ? 'win64' : 'stdcall'
};

},{"./guid":7,"./struct":8}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJUZXN0LURvdE5ldEJyaWRnZS5qcyIsImxvY2FsX3NldHRpbmdzLmpzb24iLCIuLi9jb21tb24vRG90TmV0LWRlYnVnLmpzIiwiLi4vY29tbW9uL0RvdE5ldC5qcyIsIi4uL2NvbW1vbi9jb20uanMiLCIuLi9jb21tb24vZG90bmV0LmpzIiwiLi4vY29tbW9uL2d1aWQuanMiLCIuLi9jb21tb24vc3RydWN0LmpzIiwiLi4vY29tbW9uL3dpbjMyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsYSxDQUNBOztBQUVBLE9BQU8sQ0FBQyxHQUFSLENBQVksT0FBWjs7QUFFQSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsa0JBQUQsQ0FBN0I7O0FBRUEsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLGtCQUFELENBQW5COztBQUNBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFKLENBQWlCLFFBQWpCLENBQWY7O0FBRUEsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLHdCQUFELENBQXhCOztBQUNBLFFBQVEsQ0FBQyxtQkFBVCxHLENBRUE7O0FBQ0EsTUFBTSxDQUFDLFNBQVAsQ0FBaUIsTUFBakIsQ0FBd0IsS0FBeEIsQ0FBOEIsSUFBOUI7QUFDQSxNQUFNLENBQUMsV0FBUCxDQUFtQixLQUFuQixDQUF5QixTQUF6QixDQUFtQyxPQUFuQzs7QUFFQSxTQUFTLGVBQVQsQ0FBeUIsUUFBekIsRUFBbUMsTUFBbkMsRUFBMkM7QUFDMUMsRUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLGFBQWEsUUFBYixHQUF3QixHQUF4QixHQUE4QixNQUExQzs7QUFDQSxNQUFJLE1BQU0sSUFBSSxRQUFkLEVBQXdCO0FBQ3ZCLFVBQU0sS0FBSyxDQUFDLGtEQUFrRCxRQUFsRCxHQUE2RCxZQUE3RCxHQUE0RSxNQUE3RSxDQUFYO0FBQ0E7QUFDRDs7QUFFRCxNQUFNLE9BQU8sR0FBRyxhQUFh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
