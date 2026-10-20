import React, {useState, useEffect} from "react";
import {useWialon} from "../../context/WialonProvider";

const WialonLogin = () => {
  const {session, loading, error} = useWialon();
  const [loginStatus, setLoginStatus] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (loading) {
      setLoginStatus("Initializing Wialon session...");
    } else if (error) {
      setLoginStatus(`Error: ${error}`);
    } else if (session) {
      const user = session.getCurrUser();
      if (user) {
        setLoginStatus("Logged in");
        setUserName(user.getName());
      } else {
        setLoginStatus("Session available but no user");
      }
    }
  }, [session, loading, error]);

  const login = () => {
    if (!session) {
      setLoginStatus("No session available. Wait for initialization.");
      return;
    }
    const user = session.getCurrUser();
    if (user) {
      setLoginStatus(`Already logged in as '${user.getName()}'`);
      setUserName(user.getName());
    } else {
      setLoginStatus("Session exists but no user. Provider should handle login.");
    }
  };

  const logout = () => {
    if (!session) return;
    const user = session.getCurrUser();
    if (!user) {
      setLoginStatus("Not logged in.");
      return;
    }
    session.logout((code) => {
      if (code) {
        setLoginStatus(`Logout failed: ${window.wialon.core.Errors.getErrorText(code)}`);
      } else {
        setLoginStatus("Logged out.");
        setUserName("");
      }
    });
  };

  const getUser = () => {
    if (!session) return;
    const user = session.getCurrUser();
    if (!user) {
      setLoginStatus("Not logged in.");
    } else {
      setLoginStatus(`Logged in as '${user.getName()}'`);
      setUserName(user.getName());
    }
  };

  return (
    <div>
      <h1>Wialon Login</h1>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={getUser}>Get User</button>
      <div>
        <h3>Status:</h3>
        <p>{loginStatus}</p>
        {userName && <p>Logged in as: {userName}</p>}
      </div>
    </div>
  );
};

export default WialonLogin;
