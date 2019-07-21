# DotNetBridge

DotNetBridge is a C# component that is to be created via COM, from a Frida script.  This component exists because we can't create delegates without having a compiled assembly.

## Installation

- Compile `DotNetBridge.sln` for both x86 and x64 using Visual Studio
- Execute `register.cmd` (run elevated) to call `RegAsm` on the `DotNetBridge.dll` for both x86 and x64.  Once registered, any application can call `CoCreateInstance(CLSID_DotNetBridge)` to get a bridge object.
- Consider running `Test-DotNetBridge` to validate the installation.

## API

The API consists of one object, IDotNetBridge, which is to be created exactly once per process.

### CreateObject(typeName, args)
Returns JSON value (includes OBJECTREF)

### DescribeObject(typeName, objRef)
Get JSON TypeInfo for a given full name.

### CreateDelegate(typeName, callback)
Create a suitable delegate matching typeName.

### InvokeMethod(objRef, typeName, methodName, args, genericTypesRef)
Returns JSON primitive or OBJECTREF.

### ReleaseObject(objRef)
Objects will be held indefinitely unless released.

### DescribeNamespace(nameSpace)
Returns a JSON array of TypeInfo for a given Namespace.