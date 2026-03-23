import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase, checkSupabaseHealth } from "@/integrations/supabase/client";
import { 
  subscriptionManager, 
  useRealtimeSubscription, 
  getRealtimeStatus 
} from '@/lib/realtime-manager';

/**
 * Comprehensive test page for Supabase functionality
 */
export default function SupabaseTestSuite() {
  const [activeTab, setActiveTab] = useState('connection');
  const [realtimeStatus, setRealtimeStatus] = useState(getRealtimeStatus());
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [testUserEmail, setTestUserEmail] = useState('test@example.com');
  const [testUserPassword, setTestUserPassword] = useState('Test12345!');
  const [testTable, setTestTable] = useState('schools');
  const { toast } = useToast();
  
  // Add a log message
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [message, ...prev.slice(0, 29)]);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    setError(null);
  };

  // Test supabase connection
  const testConnection = async () => {
    try {
      setError(null);
      addLog("🔄 Testing Supabase connection...");
      
      const result = await checkSupabaseHealth();
      setHealth(result);
      
      if (result.healthy) {
        addLog(`✅ Connection healthy! ${result.details?.duration ? `API latency: ${result.details.duration}ms` : ''}`);
        toast({ 
          title: "Connection Test", 
          description: "Supabase connection successful" 
        });
      } else {
        throw new Error(`Connection unhealthy: ${result.message}`);
      }
    } catch (err: any) {
      const errorMsg = `❌ Connection error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Connection Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  // Test authentication
  const testAuth = async () => {
    try {
      setError(null);
      addLog(`🔄 Testing Supabase auth with email: ${testUserEmail}...`);
      
      // First sign out any current user
      await supabase.auth.signOut();
      addLog("👋 Signed out current user");
      
      // Try to sign up a test user (this might fail if user exists, which is fine)
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testUserEmail,
        password: testUserPassword
      });
      
      if (signupError) {
        addLog(`ℹ️ Signup result: ${signupError.message}`);
      } else {
        addLog(`✅ Test user created: ${signupData.user?.id}`);
      }
      
      // Try to sign in
      const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword
      });
      
      if (signinError) {
        throw new Error(`Auth failed: ${signinError.message}`);
      }
      
      addLog(`✅ Authentication successful! User ID: ${signinData.user?.id}`);
      addLog(`🔑 Session active: ${!!signinData.session}`);
      
      toast({ 
        title: "Auth Test", 
        description: "Authentication successful" 
      });
      
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      addLog(`👤 Current user: ${user?.email} (${user?.id})`);
      
      // Sign out after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        addLog("👋 Signed out test user");
      }, 3000);
      
    } catch (err: any) {
      const errorMsg = `❌ Auth error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Auth Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  // Test database query
  const testQuery = async () => {
    try {
      setError(null);
      addLog(`🔄 Testing database query on table: ${testTable}...`);
      
      // Simple query to count records
      const { count, error: countError } = await supabase
        .from(testTable as "schools" | "students" | "teachers" | "classes" | "subjects" | "attendance" | "exams" | "exam_results" | "timetable" | "audit_logs" | "teacher_applications" | "user_profiles" | "user_roles")
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Query failed: ${countError.message}`);
      }
      
      addLog(`✅ Query successful! Found ${count} records in ${testTable}`);
      
      // Get some data
      const { data, error } = await supabase
        .from(testTable as "schools" | "students" | "teachers" | "classes" | "subjects" | "attendance" | "exams" | "exam_results" | "timetable" | "audit_logs" | "teacher_applications" | "user_profiles" | "user_roles")
        .select('*')
        .limit(3);
        
      if (error) {
        throw new Error(`Data fetch failed: ${error.message}`);
      }
      
      addLog(`📊 Sample data: ${JSON.stringify(data).substring(0, 100)}...`);
      
      toast({ 
        title: "Query Test", 
        description: `Successfully queried ${count} records from ${testTable}` 
      });
    } catch (err: any) {
      const errorMsg = `❌ Query error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Query Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };

  // Test realtime
  const testRealtime = async () => {
    try {
      setError(null);
      addLog("🔄 Testing realtime subscriptions...");
      
      // Set up a direct channel
      const channel = supabase
        .channel('test-direct-channel')
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: testTable,
          },
          (payload) => {
            addLog(`📡 Received realtime event: ${payload.eventType}`);
            toast({
              title: "Realtime Event",
              description: `Received ${payload.eventType} event on ${testTable}`,
            });
          }
        )
        .subscribe((status) => {
          addLog(`📡 Realtime status: ${status}`);
          if (status === 'SUBSCRIBED') {
            toast({
              title: "Realtime Connected",
              description: "Successfully subscribed to realtime channel",
            });
          }
        });
      
      addLog("✅ Realtime subscription active");
      addLog("ℹ️ Try making a change to the database to see events");
      
      // Cleanup after 30 seconds
      setTimeout(() => {
        supabase.removeChannel(channel);
        addLog("🧹 Cleaned up test channel");
      }, 30000);
      
    } catch (err: any) {
      const errorMsg = `❌ Realtime error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Realtime Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  // Test storage
  const testStorage = async () => {
    try {
      setError(null);
      addLog("🔄 Testing storage functionality...");
      
      // List all buckets
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
      
      if (bucketsError) {
        throw new Error(`Storage error: ${bucketsError.message}`);
      }
      
      addLog(`📂 Found ${buckets.length} storage buckets`);
      buckets.forEach(bucket => {
        addLog(`📁 Bucket: ${bucket.name}`);
      });
      
      if (buckets.length > 0) {
        // List files in the first bucket
        const { data: files, error: filesError } = await supabase
          .storage
          .from(buckets[0].name)
          .list();
          
        if (filesError) {
          addLog(`⚠️ Error listing files: ${filesError.message}`);
        } else {
          addLog(`📄 Found ${files.length} files in bucket ${buckets[0].name}`);
        }
      } else {
        addLog("ℹ️ No buckets available to list files");
      }
      
      toast({ 
        title: "Storage Test", 
        description: `Successfully tested storage functionality` 
      });
    } catch (err: any) {
      const errorMsg = `❌ Storage error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Storage Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  // Test functions
  const testFunctions = async () => {
    try {
      setError(null);
      addLog("🔄 Testing Edge Functions...");
      
      // First test if the Functions feature is available without actually calling a function
      addLog("🔍 Checking if Edge Functions feature is available...");
      
      // Extract project ref from Supabase URL for diagnostics
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      if (projectRef) {
        addLog(`📊 Detected project ref: ${projectRef}`);
        addLog(`📊 Edge Functions URL: https://${projectRef}.functions.supabase.co/`);
      }
      
      // Approach 1: Check if we can access the functions endpoint without actually invoking a function
      try {
        addLog("🧪 Testing Edge Functions feature availability...");
        
        // Create a custom function call that just checks if the feature is accessible
        const functionName = 'function-check';
        
        // We don't want to actually invoke a function, but check if the feature is available
        try {
          await supabase.functions.invoke(functionName, {
            method: 'GET', // Use GET for feature check
            headers: { 'Accept': 'application/json' }
          });
          // Unlikely to reach here unless function exists
          addLog("✅ Edge Functions API accessible and function exists");
        } catch (e: any) {
          // This is expected - we want to check the error type
          if (e.message?.includes('Failed to fetch') || 
              e.message?.includes('NetworkError') ||
              e.message?.includes('Network request failed')) {
            addLog("❌ Edge Functions API not accessible - network error");
            addLog("⚠️ This could be due to CORS restrictions or network issues");
            addLog("💡 Tip: Make sure your Supabase project has allowed the current origin in CORS settings");
            
            // Add CORS configuration instructions
            addLog("🔧 CORS Configuration Steps:");
            addLog("1️⃣ Go to Supabase Dashboard > Settings > API > CORS");
            addLog(`2️⃣ Add this origin: ${window.location.origin}`);
            addLog("3️⃣ Make sure to include the http:// or https:// prefix");
            addLog("4️⃣ Don't include trailing slashes in the origin URL");
          } else if (e.message?.includes('Function not found') || 
                    e.message?.includes('does not exist') ||
                    e.message?.includes('404')) {
            // This is actually a successful test - the API works but function doesn't exist
            addLog("✅ Edge Functions API accessible (function doesn't exist, which is expected)");
            addLog("✨ Success: The Functions API is working correctly");
          } else {
            addLog(`⚠️ Unknown error checking Edge Functions: ${e.message}`);
            
            // Try to provide more context on the error
            if (e.status) {
              addLog(`📊 HTTP Status: ${e.status}`);
            }
            
            if (e.statusText) {
              addLog(`📊 Status Text: ${e.statusText}`);
            }
          }
        }
        
        // Try another approach with a known function name that is more likely to exist
        addLog("🧪 Trying with a common function name 'hello-world'...");
        try {
          const { data, error } = await supabase.functions.invoke('hello-world', {
            body: { name: 'SchoolXnow Tester' }
          });
          
          if (error) {
            if (error.message?.includes('CORS') || error.message?.includes('origin')) {
              addLog(`⚠️ CORS error: ${error.message}`);
              addLog("💡 Tip: Add this origin to your Supabase CORS allowed origins");
              addLog(`   Current origin: ${window.location.origin}`);
              
              // Show link to docs
              addLog("📚 For more information, see: https://supabase.com/docs/guides/functions/cors");
            } else if (error.message?.includes('Function not found') || error.message?.includes('does not exist')) {
              addLog("ℹ️ The 'hello-world' function doesn't exist in your project");
              addLog("💡 Deploy a test function with: supabase functions deploy hello-world");
              
              // Show link to test function code
              addLog("📚 See the test function template in: /supabase/functions/hello-world/");
            } else {
              addLog(`⚠️ Function error: ${error.message}`);
            }
          } else {
            addLog(`✅ Function executed successfully: ${JSON.stringify(data)}`);
          }
        } catch (fnError: any) {
          // Handle different error cases
          if (fnError.message?.includes('Failed to fetch') || 
              fnError.message?.includes('NetworkError') ||
              fnError.message?.includes('Network request failed')) {
            addLog("❌ Network error calling function - likely CORS related");
            addLog("💡 Tip: In Supabase dashboard, go to Settings > API > CORS and add your origin");
            addLog(`   Current origin: ${window.location.origin}`);
            
            // Provide more debugging information
            addLog("🔍 Browser console may show more detailed error messages");
            addLog("💻 Try running server-side tests: npm run test:edge-functions-cors");
          } else if (fnError.message?.includes('Function not found') || 
                    fnError.message?.includes('does not exist')) {
            addLog("ℹ️ Function 'hello-world' not found (this is normal if you haven't created it)");
            addLog("💡 Deploy a test function with: supabase functions deploy hello-world");
            addLog("📁 Check /supabase/functions/hello-world/ for a ready-to-deploy test function");
          } else {
            addLog(`ℹ️ Error invoking function: ${fnError.message}`);
            
            // Try to provide more context on the error
            if (typeof fnError === 'object') {
              Object.keys(fnError).forEach(key => {
                if (key !== 'message' && key !== 'stack') {
                  addLog(`📊 ${key}: ${JSON.stringify(fnError[key])}`);
                }
              });
            }
          }
        }
      } catch (testError: any) {
        addLog(`⚠️ Error testing Edge Functions API: ${testError.message}`);
      }
      
      // Show link to advanced diagnostics
      addLog("🔍 For more comprehensive diagnostics, run: npm run test:edge-functions-cors");
      addLog("📚 See EDGE_FUNCTIONS_TROUBLESHOOTING.md for detailed guidance");
      
      toast({ 
        title: "Functions Test", 
        description: "Edge Functions test complete" 
      });
    } catch (err: any) {
      const errorMsg = `❌ Functions error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      addLog(errorMsg);
      toast({ 
        title: "Functions Error", 
        description: errorMsg,
        variant: "destructive"
      });
    }
  };
  
  // Run all tests
  const runAllTests = async () => {
    clearLogs();
    addLog("🔄 Running all tests sequentially...");
    
    await testConnection();
    await new Promise(r => setTimeout(r, 1000));
    
    await testAuth();
    await new Promise(r => setTimeout(r, 1000));
    
    await testQuery();
    await new Promise(r => setTimeout(r, 1000));
    
    await testRealtime();
    await new Promise(r => setTimeout(r, 1000));
    
    await testStorage();
    await new Promise(r => setTimeout(r, 1000));
    
    await testFunctions();
    
    addLog("✅ All tests completed!");
  };

  // Monitor realtime status
  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeStatus(getRealtimeStatus());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Supabase Functionality Test Suite</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Test Configuration */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Configure test parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Test User Email</label>
                <Input 
                  value={testUserEmail} 
                  onChange={(e) => setTestUserEmail(e.target.value)} 
                  placeholder="test@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Test User Password</label>
                <Input 
                  value={testUserPassword} 
                  onChange={(e) => setTestUserPassword(e.target.value)} 
                  placeholder="Password123!" 
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Test Table</label>
                <Input 
                  value={testTable} 
                  onChange={(e) => setTestTable(e.target.value)} 
                  placeholder="schools"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={runAllTests} variant="default" className="mr-2">Run All Tests</Button>
            <Button onClick={clearLogs} variant="outline">Clear Logs</Button>
          </CardFooter>
        </Card>
        
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Supabase Health:</p>
                <Badge variant={health?.healthy ? "default" : "destructive"}>
                  {health?.healthy ? 'Healthy' : health ? 'Unhealthy' : 'Unknown'}
                </Badge>
                {health?.latency && (
                  <p className="text-xs text-muted-foreground mt-1">Latency: {health.latency}ms</p>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium mb-1">Realtime Status:</p>
                <Badge variant={realtimeStatus.connected ? "default" : "outline"}>
                  {realtimeStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Subscriptions: {realtimeStatus.activeSubscriptions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Test Tabs */}
      <Tabs defaultValue="connection" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="realtime">Realtime</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
        </TabsList>
        
        {/* Connection Tab */}
        <TabsContent value="connection" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection Test</CardTitle>
              <CardDescription>Test Supabase API connection</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test verifies that your application can connect to the Supabase API
                and make basic requests. It checks the health of the connection and measures latency.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={testConnection}>Test Connection</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Authentication Tab */}
        <TabsContent value="auth" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Test</CardTitle>
              <CardDescription>Test user authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test attempts to create a test user and then sign in with those credentials.
                It will also retrieve the user profile and then sign out at the end.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={testAuth}>Test Authentication</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Database Tab */}
        <TabsContent value="database" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Query Test</CardTitle>
              <CardDescription>Test database access</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test attempts to query the database to verify that your application
                has proper access to the data. It will count records and fetch a sample.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={testQuery}>Test Database Query</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Realtime Tab */}
        <TabsContent value="realtime" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Realtime Test</CardTitle>
              <CardDescription>Test realtime subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test sets up a realtime subscription to the database. After running this test,
                try making changes to the database to see if events are received.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={testRealtime}>Test Realtime</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Storage Tab */}
        <TabsContent value="storage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Test</CardTitle>
              <CardDescription>Test storage functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test verifies access to Supabase Storage. It will list available 
                buckets and files if any exist.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={testStorage}>Test Storage</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Functions Tab */}
        <TabsContent value="functions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Edge Functions Test</CardTitle>
              <CardDescription>Test Supabase Edge Functions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This test checks if Supabase Edge Functions are accessible from your application.
                It will attempt to determine if the Edge Functions feature is available, even if
                no specific functions are deployed.
              </p>
              <div className="bg-muted p-3 rounded-md mb-4 text-sm">
                <p className="font-medium mb-2">Common Issues:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    <strong>CORS Errors</strong> - In the Supabase Dashboard, go to 
                    <span className="font-mono bg-accent/20 px-1 rounded">Settings &gt; API &gt; CORS</span> 
                    and add this origin: <span className="font-mono bg-accent/20 px-1 rounded">{window.location.origin}</span>
                  </li>
                  <li>
                    <strong>Function Not Found</strong> - This is normal if you haven't created any Edge Functions
                  </li>
                  <li>
                    <strong>Network Errors</strong> - May indicate Edge Functions are not enabled for your project
                  </li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-md mb-4">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                  Advanced Diagnostics
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  For more comprehensive diagnostics, run the following command in the terminal:
                </p>
                <pre className="bg-blue-100 dark:bg-blue-900 p-2 rounded mt-2 overflow-x-auto text-xs">
                  npm run test:edge-functions-cors
                </pre>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  This will run server-side tests that can bypass CORS restrictions and provide more detailed error information.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={testFunctions}>Test Functions</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Logs Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Test Logs</CardTitle>
          <CardDescription>Output from test operations</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] overflow-y-auto bg-muted/50 rounded p-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs yet. Run a test to see output.</p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className="border-b border-border/40 pb-1">
                  {log}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
