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
            Process process = new Process();
            process.StartInfo.FileName = args[0];
            process.StartInfo.Arguments = string.Join(" ", args.Skip(1));
            process.StartInfo.CreateNoWindow = true;
            process.StartInfo.UseShellExecute = false;

            // redirect std input, output and error

            /* DES-COMMENT THIS WHEN STDIN PROPAGATION HAS BEEN TESTED
            process.StartInfo.RedirectStandardInput = true;
            */

            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.RedirectStandardError = true;

            // output and error (asynchronous) handlers
            process.OutputDataReceived += new DataReceivedEventHandler(StdOutHandler);
            process.ErrorDataReceived += new DataReceivedEventHandler(StdErrHandler);

            process.Start();

            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            /* DES-COMMENT THIS WHEN STDIN PROPAGATION HAS BEEN TESTED
            // acquire the standard input stream
            Stream input = Console.OpenStandardInput();

            byte[] buffer = new byte[1024];
            int length;

            if (IsPipedInput()) {
                // reading stdin in current thread and delegate to process
                while (input.CanRead) {
                    length = input.Read(buffer, 0, buffer.Length);

                    if (length > 0) {
                        byte[] payload = new byte[length];

                        Buffer.BlockCopy(buffer, 0, payload, 0, length);

                        // writing to process stdin
                        process.StandardInput.WriteLine(Encoding.UTF8.GetString(payload));
                    }
                }
            }
            */

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

        private static bool IsPipedInput() {
            bool isKeyAvailable;

            try {
                isKeyAvailable = Console.KeyAvailable;
            } catch {
                isKeyAvailable = false;
            }

            return IsConsoleSizeZero && isKeyAvailable;
        }

        private static bool IsConsoleSizeZero {
            get {
                try {
                    return (0 == (Console.WindowHeight + Console.WindowWidth));
                } catch {
                    return true;
                }
            }
        }
    }
}
