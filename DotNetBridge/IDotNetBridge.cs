using System;
using System.Runtime.InteropServices;

namespace DotNetBridge
{
    [ComVisible(true)]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b")]
    public interface IDotNetBridge
    {
        [return: MarshalAs(UnmanagedType.LPWStr)]
        string CreateObject(
            [MarshalAs(UnmanagedType.LPWStr)]string typeName, 
            [MarshalAs(UnmanagedType.LPWStr)]string args);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string DescribeObject(
            [MarshalAs(UnmanagedType.LPWStr)]string typeName, 
            [MarshalAs(UnmanagedType.LPWStr)]string objRef);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string CreateDelegate(
            [MarshalAs(UnmanagedType.LPWStr)]string typeName, 
            IntPtr callback);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string InvokeMethod(
            [MarshalAs(UnmanagedType.LPWStr)]string objRef, 
            [MarshalAs(UnmanagedType.LPWStr)]string typeName,
            [MarshalAs(UnmanagedType.LPWStr)]string methodName, 
            [MarshalAs(UnmanagedType.LPWStr)]string args, 
            [MarshalAs(UnmanagedType.LPWStr)]string genericTypesRef, 
            int boxed);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string ReleaseObject(
            [MarshalAs(UnmanagedType.LPWStr)]string objRef);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string DescribeNamespace(
            [MarshalAs(UnmanagedType.LPWStr)]string nameSpace);

        [return: MarshalAs(UnmanagedType.LPWStr)]
        string SwitchToAppDomain(
            [MarshalAs(UnmanagedType.LPWStr)]string friendlyName, 
            IntPtr callback);
    }
}
