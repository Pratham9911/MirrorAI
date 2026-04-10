// "use client";

// import { supabase } from '@/lib/supabaseClient';

// export default function TestPage() {

//   const handleSignup = async () => {
//     const { data, error } = await supabase.auth.signUp({
//       email: 'prathamtiwari0123@gmail.com',
//       password: '12345678',
//     });

//     console.log('DATA:', data);
//     console.log('ERROR:', error);
//   };

//   return (
//     <div>
//       <h1>Supabase Test</h1>
//       <button onClick={handleSignup}>
//         Test Signup
//       </button>
//     </div>
//   );
// }

"use client";

import { supabase } from '@/lib/supabaseClient';

export default function TestPage() {

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:3000/dash',
  },
});

    if (error) console.log(error);
  };

  return (
    <div>
      <h1>Google Auth Test</h1>
      <button onClick={handleGoogleLogin}>
        Login with Google 🚀
      </button>
    </div>
  );
}