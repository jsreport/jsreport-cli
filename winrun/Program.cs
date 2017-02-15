using System;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WinRun
{
    class Program
    {
        static void Main(string[] args)
        {
            // There were already an unsucessfull attemp to implement full stdin forwarding 
            // between node and .net process, this stored here
            // https://github.com/pofider/node-silent-spawn/pull/1
            

            Process process = new Process();
            process.StartInfo.FileName = args[0];
            process.StartInfo.Arguments = string.Join(" ", args.Skip(1));
            process.StartInfo.CreateNoWindow = true;
            process.StartInfo.UseShellExecute = false;

            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.RedirectStandardError = true;

            // output and error (asynchronous) handlers
            process.OutputDataReceived += new DataReceivedEventHandler(StdOutHandler);
            process.ErrorDataReceived += new DataReceivedEventHandler(StdErrHandler);

            process.Start();

            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            
            // wait until the associated process terminates
            process.WaitForExit();
        }

        static void StdOutHandler(object sendingProcess, DataReceivedEventArgs outLine) {
            // propagate process's stdout output to current stdout
            Console.Out.WriteLine(outLine.Data);
            Console.Out.Flush();
        }

        static void StdErrHandler(object sendingProcess, DataReceivedEventArgs outLine) {
            // propagate process's stderr output to current stderr
            Console.Error.WriteLine(outLine.Data);
            Console.Error.Flush();
        }
    }
}
