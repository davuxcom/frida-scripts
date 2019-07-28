using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;

namespace DotNetBridge
{
    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    [Guid("ddb71722-f7e5-4c45-817e-cc1b84bfab4e")]
    public class DotNetBridge : IDotNetBridge
    {
        delegate IntPtr JsonDelegate(IntPtr args);

        int _lastObjectId = 0;
        Dictionary<int, object> _objects = new Dictionary<int, object>();

        public string CreateObject(string typeName, string args)
        {
            return NoThrowBoundary(() => DehydrateResult(Activator.CreateInstance(FindTypeByName(typeName), HydrateArguments(args))));
        }

        public string ReleaseObject(string objRef)
        {
            return NoThrowBoundary(() => _objects.Remove(JsonToObject<OBJECT>(objRef).Id));
        }

        public string DescribeObject(string typeName, string objRef)
        {
            return NoThrowBoundary(() =>
            {
                Type type;
                object instance = null;
                if (string.IsNullOrWhiteSpace(objRef))
                {
                    type = FindTypeByName(typeName);
                }
                else
                {
                    instance = ObjectRefToObject(JsonToObject<OBJECT>(objRef));
                    type = instance.GetType();
                }

                return new TypeInfo
                {
                    TypeName = type.FullName,
                    IsEnum = type.GetTypeInfo().IsEnum,
                    IsDelegate = typeof(MulticastDelegate).IsAssignableFrom(type.GetTypeInfo().BaseType),
                    NestedTypes = type.GetNestedTypes(BindingFlags.Public).Select(t => t.FullName).ToArray(),
                    Fields = type.GetFields(BindingFlags.Static | BindingFlags.Instance | BindingFlags.Public).Select(f => f.Name).ToArray(),
                    Methods = type.GetMethods().Select(m =>
                        new MethodInfo
                        {
                            Name = m.Name,
                            Parameters = m.GetParameters().Select(p => p.Name).ToArray(),
                        }).ToArray(),
                    EnumValue = (type.GetTypeInfo().IsEnum && instance != null) ? Convert.ChangeType(instance, Enum.GetUnderlyingType(instance.GetType())) : 0,
                };
            });
        }

        public string CreateDelegate(string typeName, IntPtr callback)
        {
            return NoThrowBoundary(() =>
            {
                return DehydrateResult(Delegate_Wrapper.Create((args) =>
                {
                    var jsonCallback = (JsonDelegate)Marshal.GetDelegateForFunctionPointer(callback, typeof(JsonDelegate));
                    var json_args = ObjectToJson(args.Select(a => DehydrateResult(a)).ToArray());
                    var ret = JsonToObject<object>(Marshal.PtrToStringUni(jsonCallback(Marshal.StringToHGlobalUni(json_args))));
                    if (ret != null && ret.GetType() == typeof(OBJECT))
                    {
                        ret = ObjectRefToObject((OBJECT)ret);
                    }
                    return ret;
                }, FindTypeByName(typeName)));
            });
        }

        public string InvokeMethod(string objRef, string typeName, string methodName, string args, string genericTypesRef, int box)
        {
            bool returnBoxed = box == 1;
            return NoThrowBoundary(() =>
            {
                Type type;
                object instance = null;
                if (!string.IsNullOrWhiteSpace(objRef))
                {
                    instance = ObjectRefToObject(JsonToObject<OBJECT>(objRef));
                    type = instance.GetType();
                }
                else
                {
                    type = FindTypeByName(typeName);
                }

                var parameters = HydrateArguments(args);
                var method = type.GetMethod(methodName, parameters.Select(s => s.GetType()).ToArray());
                if (method == null) // Fuzzy match for types that will cast.
                {
                    method = type.GetMethods().FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == parameters.Length);
                }

                if (method != null)
                {
                    if (!string.IsNullOrWhiteSpace(genericTypesRef))
                    {
                        method = method.MakeGenericMethod((Type[])ObjectRefToObject(JsonToObject<OBJECT>(genericTypesRef)));
                    }

                    var resolvedArgs = HydrateArguments(args);
                    var refMap = resolvedArgs.Select(o => ObjetToObjectRef(o)).ToArray();
                    var rawRet = method.Invoke(instance, resolvedArgs);
                    // 'out' and 'ref' params must be picked up if they changed.
                    for (var i = 0; i < refMap.Length; ++i)
                    {
                        if (refMap[i] > -1) { _objects[refMap[i]] = resolvedArgs[i]; }
                    }
                    return DehydrateResult(rawRet, returnBoxed);
                }
                else
                {
                    var property = type.GetField(methodName, BindingFlags.Static | BindingFlags.Public | BindingFlags.Instance);
                    if (property != null)
                    {
                        if (parameters.Length == 0)
                        {
                            return DehydrateResult(property.GetValue(instance), returnBoxed);
                        }
                        else if (parameters.Length == 1)
                        {
                            property.SetValue(instance, parameters[0]);
                            return null;
                        }
                    }
                    throw new InvalidOperationException("DotNetBridge.Call: Didn't find method or field: m:" + methodName + " o:" + objRef + " i:" + instance + " a:" + args);
                }
            });
        }

        public string DescribeNamespace(string nameSpace)
        {
            return NoThrowBoundary(() =>
            {
                var ret = new List<NamespaceInfo>();
                var matchNamespaces = new HashSet<string>();
                foreach (var type in GetLoadedAssemblies().SelectMany(a => a.GetTypes()))
                {
                    if (type.FullName.Contains("<") || type.FullName.Contains("+")) { continue; };

                    if (type.FullName.StartsWith(nameSpace + "."))
                    {
                        if (type.FullName.LastIndexOf('.') == nameSpace.Length)
                        {
                            ret.Add(new NamespaceInfo { Name = type.Name, IsType = true });
                        }
                        else
                        {
                            matchNamespaces.Add(type.FullName.Substring(nameSpace.Length + 1, 
                                type.FullName.Substring(nameSpace.Length + 1).IndexOf(".")));
                        }
                    }
                }
                ret.AddRange(matchNamespaces.Select(namespaceName => new NamespaceInfo { Name = namespaceName, IsType = false }));
                return ret;
            });
        }

        public string SwitchToAppDomain(string friendlyName, IntPtr callback)
        {
            return NoThrowBoundary(() =>
            {
                AppDomainSwitcher.TrySwitchToOther(friendlyName, callback);
                return null;
            });
        }

        int ObjetToObjectRef(object o) { return _objects.ContainsValue(o) ? _objects.FirstOrDefault(x => x.Value == o).Key : -1; }

        object ObjectRefToObject(OBJECT o) { return _objects[o.Id]; }

        string NoThrowBoundary(Func<object> invoke)
        {
            try
            {
                return ObjectToJson(invoke());
            }
            catch (Exception ex)
            {
                ex = ex.InnerException != null ? ex.InnerException : ex;
                return ObjectToJson(new ERROR { Message = ex.Message, Stack = ex.StackTrace });
            }
        }

        DataContractJsonSerializer GetBridgeSerializer(Type type)
        {
            return new DataContractJsonSerializer(type, new DataContractJsonSerializerSettings
            {
                EmitTypeInformation = EmitTypeInformation.Always,
                KnownTypes = new Type[] { typeof(OBJECT), typeof(ERROR), typeof(MethodInfo), typeof(TypeInfo), typeof(NamespaceInfo) },
            });
        }

        T JsonToObject<T>(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) { return default(T); }
            using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
            {
                return (T)GetBridgeSerializer(typeof(T)).ReadObject(ms);
            }
        }

        string ObjectToJson(object o)
        {
            if (o == null) { return "null"; }
            using (var ms = new MemoryStream())
            {
                GetBridgeSerializer(o.GetType()).WriteObject(ms, o);
                ms.Position = 0;
                return new StreamReader(ms).ReadToEnd();
            }
        }

        object[] HydrateArguments(string args)
        {
            var resolved = JsonToObject<object[]>(args);
            for (var i = 0; i < resolved.Length; ++i)
            {
                if (resolved[i].GetType() == typeof(OBJECT))
                {
                    resolved[i] = ObjectRefToObject((OBJECT)resolved[i]);
                }
                else if (resolved[i].GetType() == typeof(decimal))
                {
                    resolved[i] = double.Parse(resolved[i].ToString());
                }
            }
            return resolved;
        }

        object DehydrateResult(object output, bool returnOnlyObjects = false)
        {
            if (output == null || (!returnOnlyObjects && !output.GetType().GetTypeInfo().IsEnum && 
                (output.GetType().GetTypeInfo().IsPrimitive || output.GetType() == typeof(string))))
            {
                return output;
            }
            else
            {
                lock (_objects)
                {
                    var objId = ++_lastObjectId;
                    _objects.Add(objId, output);
                    return new OBJECT { Id = objId };
                }
            }
        }

        IEnumerable<Assembly> GetLoadedAssemblies()
        {
#if NETFX_CORE
            return new Assembly[] { typeof(System.String).GetTypeInfo().Assembly };
#else
            return AppDomain.CurrentDomain.GetAssemblies();
#endif
        }

        Type FindTypeByName(string typeName)
        {
            Type type = GetLoadedAssemblies().Select(a => a.GetType(typeName)).FirstOrDefault(t => t != null);
            if (type == null)
            {
                throw new ApplicationException("Can't resolve typeName: " + typeName);
            }
            return type;
        }
    }
}