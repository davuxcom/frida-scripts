using System;
using System.Collections.Generic;
using System.Linq;

namespace DotNetBridge
{
    class Delegate_Wrapper<TRet, TArg1, TArg2, TArg3, TArg4, TArg5, TArg6, TArg7, TArg8, TArg9, TArg10>
    {
        Func<object[], object> _Invoked;
        public Delegate_Wrapper(Func<object[], object> callback) { _Invoked = callback; }
        public void Action_0() { _Invoked(new object[] { }); }
        public void Action_1(TArg1 arg1) { _Invoked(new object[] { arg1 }); }
        public void Action_2(TArg1 arg1, TArg2 arg2) { _Invoked(new object[] { arg1, arg2 }); }
        public void Action_3(TArg1 arg1, TArg2 arg2, TArg3 arg3) { _Invoked(new object[] { arg1, arg2, arg3 }); }
        public void Action_4(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4) { _Invoked(new object[] { arg1, arg2, arg3, arg4 }); }
        public void Action_5(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5 }); }
        public void Action_6(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6 }); }
        public void Action_7(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7 }); }
        public void Action_8(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8 }); }
        public void Action_9(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8, TArg9 arg9) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 }); }
        public void Action_10(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8, TArg9 arg9, TArg10 arg10) { _Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10 }); }
        public TRet Func_0() { return (TRet)_Invoked(new object[] { }); }
        public TRet Func_1(TArg1 arg1) { return (TRet)_Invoked(new object[] { arg1 }); }
        public TRet Func_2(TArg1 arg1, TArg2 arg2) { return (TRet)_Invoked(new object[] { arg1, arg2 }); }
        public TRet Func_3(TArg1 arg1, TArg2 arg2, TArg3 arg3) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3 }); }
        public TRet Func_4(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4 }); }
        public TRet Func_5(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5 }); }
        public TRet Func_6(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6 }); }
        public TRet Func_7(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7 }); }
        public TRet Func_8(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8 }); }
        public TRet Func_9(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8, TArg9 arg9) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 }); }
        public TRet Func_10(TArg1 arg1, TArg2 arg2, TArg3 arg3, TArg4 arg4, TArg5 arg5, TArg6 arg6, TArg7 arg7, TArg8 arg8, TArg9 arg9, TArg10 arg10) { return (TRet)_Invoked(new object[] { arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10 }); }
    }
    class Delegate_Wrapper
    {
        public static Delegate Create(Func<object[], object> callback, Type type)
        {
            var invokeMethod = type.GetMethod("Invoke");
            List<Type> GenericTypes = new List<Type>();
            GenericTypes.Add(invokeMethod.ReturnType == typeof(void) ? typeof(object) : invokeMethod.ReturnType);
            GenericTypes.AddRange(invokeMethod.GetParameters().Select(p => p.ParameterType));
            while (GenericTypes.Count < 11) { GenericTypes.Add(typeof(object)); }

            var delegateWrappedInstance = Activator.CreateInstance(typeof(Delegate_Wrapper<,,,,,,,,,,>).MakeGenericType(GenericTypes.ToArray()), new object[] { callback });
            var delegateWrappedMethod = delegateWrappedInstance.GetType().GetMethod(
                (invokeMethod.ReturnType == typeof(void) ? "Action_" : "Func_") + invokeMethod.GetParameters().Length);
            return MulticastDelegate.CreateDelegate(type, delegateWrappedInstance, delegateWrappedMethod);
        }
    }
}
