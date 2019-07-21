using System.Runtime.Serialization;

namespace DotNetBridge
{
    [DataContract(Namespace = "")]
    class OBJECT
    {
        [DataMember] public int __OBJECT = 1;
        [DataMember] public int Id;
    }

    [DataContract(Namespace = "")]
    class ERROR
    {
        [DataMember] public int __ERROR = 1;
        [DataMember] public string Message;
        [DataMember] public string Stack;
    }

    [DataContract(Namespace = "")]
    class MethodInfo
    {
        [DataMember] public string Name;
        [DataMember] public string[] Parameters;
    }

    [DataContract(Namespace = "")]
    class TypeInfo
    {
        [DataMember] public string TypeName;
        [DataMember] public bool IsDelegate;
        [DataMember] public bool IsEnum;
        [DataMember] public MethodInfo[] Methods;
        [DataMember] public string[] Fields;
        [DataMember] public object EnumValue;
        [DataMember] public string[] NestedTypes;
    }

    [DataContract(Namespace = "")]
    class NamespaceInfo
    {
        [DataMember] public string Name;
        [DataMember] public bool IsType;
    }
}
