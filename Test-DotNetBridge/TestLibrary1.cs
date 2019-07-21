using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TestLibrary1
{
    public class Test1
    {
        public static int Static5 = 5;
        public int Instance5 = 5;

        public static string TestMethod() {
            return "TestMethod";
        }
        
        public static string TestGenericMethod<T>(T args)
        {
            return args.GetType().ToString();
        }
        
        public static string TestGenericMethod<T,V>(T args, V args2)
        {
            return args.GetType().ToString() + " " + args2.GetType().ToString();
        }
        
        public static void TestRef(ref int i) {
            i = 10;
        }
        
        public static void TestOut(out int i) {
            i = 10;
        } 
        
        public class NestedClass {
            public int Instance5 = 5;
            
            public class TwiceNestedClass {
                public int Instance7 = 7;
            }
        }
    }
}