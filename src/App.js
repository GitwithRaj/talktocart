import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";
import Auth from "./Auth";
import Cart from "./Cart";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [showAuth, setShowAuth] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const recognitionRef = useRef(null);

  const allowedItems = [
    "shirt",
    "pants",
    "jeans",
    "tshirt",
    "shoes",
    "jacket",
    "hat",
    "socks",
    "scarf",
    "blazer",
    "skirt",
    "sweater",
    "shorts",
    "watch",
    "belt",
    "sunglasses",
    "handbag",
    "boots",
  ];

  const MAX_ITEM_QTY = 5;

  const itemPrices = {
    shirt: 20,
    pants: 25,
    jeans: 30,
    tshirt: 15,
    shoes: 50,
    jacket: 60,
    hat: 10,
    socks: 5,
    scarf: 12,
    blazer: 45,
    skirt: 22,
    sweater: 35,
    shorts: 18,
    watch: 80,
    belt: 15,
    sunglasses: 25,
    handbag: 55,
    boots: 65,
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setShowAuth(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const filterItems = (items) => {
    const filtered = {};
    for (const [item, qty] of Object.entries(items || {})) {
      const lowerItem = item.toLowerCase();
      if (allowedItems.includes(lowerItem) && Number(qty) > 0) {
        filtered[lowerItem] = qty;
      }
    }
    return filtered;
  };

  const applyStyles = (cssChanges) => {
    for (const selector in cssChanges) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        Object.entries(cssChanges[selector]).forEach(([prop, value]) => {
          el.style[prop] = value;
        });
      });
    }
  };

  const updateCart = (add = {}, remove = {}, message) => {
    let newError = "";

    setCart((prevCart) => {
      const updatedCart = { ...prevCart };

      for (const [item, qty] of Object.entries(filterItems(add))) {
        const currentQty = updatedCart[item] || 0;
        const newQty = currentQty + qty;
        if (newQty > MAX_ITEM_QTY) {
          const allowedQty = MAX_ITEM_QTY - currentQty;
          if (allowedQty > 0) {
            updatedCart[item] = currentQty + allowedQty;
            newError += `⚠️ Only ${allowedQty} ${item}(s) added. Max limit is ${MAX_ITEM_QTY}.\n`;
          } else {
            newError += `❌ Cannot add more than ${MAX_ITEM_QTY} ${item}(s).\n`;
          }
          continue;
        }
        updatedCart[item] = newQty;
      }

      for (const [item, qty] of Object.entries(filterItems(remove))) {
        const currentQty = updatedCart[item] || 0;
        const newQty = Math.max(0, currentQty - qty);
        if (newQty === 0) {
          delete updatedCart[item];
        } else {
          updatedCart[item] = newQty;
        }
      }

      setError(newError.trim());
      if (message) setError(message);

      saveCartToServer(updatedCart);
      return updatedCart;
    });
  };

  const saveCartToServer = async (cartData) => {
    if (!user) return;
    try {
      // const res = await fetch(`http://localhost:8001/carts?userId=${user.id}`);
      const res = await fetch(
        `https://talktocartserver.onrender.com/carts?userId=${user.id}`
      );
      const data = await res.json();
      if (data.length > 0) {
        // await fetch(`http://localhost:8001/carts/${data[0].id}`,
        await fetch(
          `https://talktocartserver.onrender.com/carts/${data[0].id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data[0].id,
              userId: user.id,
              items: cartData,
            }),
          }
        );
      } else {
        //await fetch(`http://localhost:8001/carts`,
        await fetch(`https://talktocartserver.onrender.com/carts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, items: cartData }),
        });
      }
    } catch (e) {
      console.error("Cart save failed", e);
    }
  };

  useEffect(() => {
    const loadCart = async () => {
      if (!user) return;
      try {
        const res = await fetch(
          // `http://localhost:8001/carts?userId=${user.id}`
          `https://talktocartserver.onrender.com/carts?userId=${user.id}`
        );
        const data = await res.json();
        if (data.length > 0) {
          setCart(data[0].items || {});
        }
      } catch (e) {
        console.error("Failed to load cart", e);
      }
    };

    loadCart();
  }, [user]);

  const handlePrompt = async (overridePrompt = null) => {
    setLoading(true);
    setError("");
    const finalPrompt = overridePrompt || prompt;
    try {
      const res = await fetch("https://talktocart-backend.onrender.com/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, cart }),
      });

      const data = await res.json();
      const { add = {}, remove = {}, message, action, cssChanges } = data;

      if (action === "generate_invoice") {
        if (Object.keys(cart).length === 0) {
          setError("❌ Your cart is empty. No invoice can be generated.");
        } else {
          generateInvoice();
          setError(message || "✅ Invoice generated.");
        }
      } else if (action === "update_ui" && cssChanges) {
        applyStyles(cssChanges);
        setError(message || "✅ UI updated.");
      } else {
        updateCart(add, remove, message);
      }
      setPrompt("");
    } catch (err) {
      console.error("Fetch error:", err);
      setError("❌ Failed to fetch or parse from backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleManual = (item, action) => {
    if (action === "add") updateCart({ [item]: 1 }, {});
    else if (action === "remove") updateCart({}, { [item]: 1 });
  };

  const handleVoice = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError("🎤 Listening... Speak your cart command.");
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event);
      setError("❌ Voice recognition failed. Try again.");
    };

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;
      setPrompt(spokenText);
      setLoading(true);
      setError("");

      try {
        const res = await fetch("http://127.0.0.1:8000/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: spokenText, cart }),
        });

        const data = await res.json();
        const { add = {}, remove = {}, message, action, cssChanges } = data;

        if (action === "generate_invoice") {
          if (Object.keys(cart).length === 0) {
            setError("❌ Your cart is empty. No invoice can be generated.");
          } else {
            generateInvoice();
            setError(message || "✅ Invoice generated.");
          }
        } else if (action === "update_ui" && cssChanges) {
          applyStyles(cssChanges);
          setError(message || "✅ UI updated.");
        } else {
          updateCart(add, remove, message);
        }

        setPrompt("");

        // 🔊 Voice Reply
        if (message) {
          const synth = window.speechSynthesis;
          const utter = new SpeechSynthesisUtterance(message);
          utter.lang = "en-US";
          synth.speak(utter);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("❌ Failed to fetch or parse from backend.");
      } finally {
        setLoading(false);
      }
    };

    recognition.onend = () => {
      console.log("Voice recognition ended");
    };

    recognition.start();
  };

  const generateInvoice = () => {
    const doc = new jsPDF();
    const userEmail = user?.username || "Unknown";

    const now = new Date();
    const formattedDate = now.toLocaleDateString();

    // Header
    doc.setFontSize(22);
    doc.text("TalkToCart", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text("123 TalkToCart Lane, Fashion City, IN 123456", 105, 22, {
      align: "center",
    });
    doc.text("Email: support@talktocart.com | Phone: +91-9999999999", 105, 27, {
      align: "center",
    });

    // Invoice Info
    doc.setFontSize(14);
    doc.text("INVOICE", 105, 38, { align: "center" });

    doc.setFontSize(11);
    doc.text(`Date: ${formattedDate}`, 14, 45);
    doc.text(`BILL TO: ${userEmail}`, 14, 52);

    let y = 60;

    const tableRows = [];
    let subtotal = 0;

    for (const [item, qty] of Object.entries(cart)) {
      const price = itemPrices[item] || 0;
      const total = qty * price;
      subtotal += total;
      tableRows.push([
        item.toUpperCase(),
        qty,
        `$${price.toFixed(2)}`,
        `$${total.toFixed(2)}`,
      ]);
    }

    const gst = subtotal * 0.18;
    const grandTotal = subtotal + gst;

    // Table with autoTable
    autoTable(doc, {
      head: [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]],
      body: tableRows,
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        halign: "center",
      },
      styles: { halign: "center" },
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 150, finalY);
    doc.text(`GST (18%): $${gst.toFixed(2)}`, 150, finalY + 6);
    doc.setFontSize(14);
    doc.text(`Balance Due: $${grandTotal.toFixed(2)}`, 150, finalY + 14);

    // Footer
    doc.setFontSize(11);
    doc.text("Thank you for shopping with TalkToCart!", 14, finalY + 25);

    doc.save("invoice.pdf");
  };
  if (showAuth) return <Auth onLogin={handleLogin} />;
  if (showCart)
    return (
      <Cart
        cart={cart}
        itemPrices={itemPrices}
        generateInvoice={generateInvoice}
        onBack={() => setShowCart(false)}
        user={user}
      />
    );

  return (
    <div className="App">
      <h1 className="brand">🛍️ TalkToCart</h1>
      <div className="navbar">
        <div className="navbar-row">
          <div className="prompt-input">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Add 2 shirts and remove 1 jacket"
            />
            <button onClick={() => handlePrompt()} disabled={loading}>
              {loading ? "..." : "Submit"}
            </button>
            <button onClick={handleVoice} disabled={loading}>
              🎙️ Voice
            </button>
          </div>
          <div className="navbar-actions">
            <button onClick={() => setShowCart(true)} className="cart-btn">
              🛒 Cart
              {Object.keys(cart).length > 0 && (
                <span className="cart-badge">{Object.keys(cart).length}</span>
              )}
            </button>
            {user ? (
              <>
                <span className="user">👤 {user.username}</span>
                <button className="logout-btn" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </>
            ) : (
              <button className="login-btn" onClick={() => setShowAuth(true)}>
                🔐 Login / Register
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          <button className="dismiss-btn" onClick={() => setError("")}>
            ✖
          </button>
          <pre className="error-msg">{error}</pre>
        </div>
      )}

      <div className="main-content">
        <div className="products">
          <h2>🧥 Available Items</h2>
          <div className="card-grid">
            {allowedItems.map((item) => (
              <div className="card" key={item}>
                <div className="card-image">
                  <img
                    src={`${process.env.PUBLIC_URL}/images/${item}.jpg`}
                    alt={item}
                  />
                </div>
                <div className="card-content">
                  <h3>{item.toUpperCase()}</h3>
                  <p>${itemPrices[item]}</p>
                  <div className="card-actions">
                    <button onClick={() => handleManual(item, "add")}>
                      ➕ Add
                    </button>
                    <button onClick={() => handleManual(item, "remove")}>
                      ➖ Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
