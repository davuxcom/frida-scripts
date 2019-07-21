# DotNetBridge

DotNetBridge is a C# component that is to be created via COM, from a Frida script.  This component exists because we can't create delegates without having a compiled assembly.

## Installation

Use `register.cmd` (run elevated) to call `RegAsm` on the DotNetBridge.dll for both x86 and x64.  Once registered, any application can call `CoCreateInstance(CLSID_DotNetBridge)` to get a bridge object.

## API

The API consists of one object, IDotNetBridge, which is to be created exactly once per process.

### CreateObject(typeName, args)
Returns object.

### DescribeObject(typeName, objRef)
Returns type info

### CreateDelegate(typeName, callback)
Returns object.

### InvokeMethod(objRef, typeName, methodName, args, genericTypesRef)
Returns primitive or object.

### ReleaseObject(objRef)
Objects will be held indefinitely unless released.

### DescribeNamespace(nameSpace)
Returns type info set.