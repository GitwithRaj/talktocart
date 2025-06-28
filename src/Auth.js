import { useState, useRef, useEffect } from "react";
import "./Auth.css";

function AuthForm({ onLogin }) {
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async () => {
    try {
      const res = await fetch(
        `http://localhost:8001/users?username=${username}`
      );
      if (!res.ok) throw new Error("User lookup failed");
      const users = await res.json();

      if (authMode === "login") {
        if (users.length && users[0].password === password) {
          alert("Login successful");
          onLogin(users[0]);
        } else {
          alert("Invalid credentials");
        }
      } else {
        if (users.length) {
          alert("User already exists");
        } else {
          // Register new user
          const createRes = await fetch("http://localhost:8001/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          if (!createRes.ok) {
            throw new Error("Registration failed");
          }

          // Fetch newly created user
          const userRes = await fetch(
            `http://localhost:8001/users?username=${username}`
          );
          const newUserData = await userRes.json();

          if (newUserData.length) {
            alert("Registration successful");
            onLogin(newUserData[0]);
          } else {
            alert(
              "User created but could not auto-login. Please try logging in."
            );
            setAuthMode("login");
          }
        }
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="auth-form">
      <h3>{authMode === "login" ? "Login" : "Register"}</h3>
      <input
        type="text"
        name="username"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="off"
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />

      <button onClick={handleAuth}>
        {authMode === "login" ? "Login" : "Register"}
      </button>
      <button
        onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
      >
        Switch to {authMode === "login" ? "Register" : "Login"}
      </button>
    </div>
  );
}

export default AuthForm;
