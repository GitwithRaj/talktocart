import { useState, useRef } from "react";
import jsPDF from "jspdf";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      return updatedCart;
    });
  };

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
      const { add = {}, remove = {}, message, action } = data;

      if (action === "generate_invoice") {
        if (Object.keys(cart).length === 0) {
          setError("❌ Your cart is empty. No invoice can be generated.");
        } else {
          generateInvoice();
          setError(message || "✅ Invoice generated.");
        }
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

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setPrompt(spokenText);
      handlePrompt(spokenText);
    };

    recognition.onend = () => {
      console.log("Voice recognition ended");
    };

    recognition.start();
  };

  const generateInvoice = () => {
    const doc = new jsPDF();
    let y = 10;
    let total = 0;

    doc.setFontSize(16);
    doc.text("🛍️ TalkToCart Invoice", 10, y);
    y += 10;
    doc.setFontSize(12);
    doc.text("Item", 10, y);
    doc.text("Qty", 80, y);
    doc.text("Price", 120, y);
    doc.text("Subtotal", 160, y);
    y += 6;

    for (const [item, qty] of Object.entries(cart)) {
      const price = itemPrices[item] || 0;
      const subtotal = price * qty;
      total += subtotal;
      doc.text(item.toUpperCase(), 10, y);
      doc.text(String(qty), 80, y);
      doc.text(`$${price}`, 120, y);
      doc.text(`$${subtotal}`, 160, y);
      y += 6;
    }

    y += 4;
    doc.text(`Total: $${total}`, 10, y);
    y += 10;
    doc.text("Thank you for shopping with us!", 10, y);

    doc.save("invoice.pdf");
  };

  return (
    <div className="App">
      <h1>🛍️ TalkToCart: Fashion Edition</h1>

      <div className="prompt-section">
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
                  <img src={`/images/${item}.jpg`} alt={item} />
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

        <div className="cart">
          <h2>🛒 Your Cart</h2>
          {Object.keys(cart).length === 0 ? (
            <p>🪶 Your cart is empty.</p>
          ) : (
            <>
              <div className="cart-items">
                {Object.entries(cart).map(([item, qty]) => (
                  <div className="cart-card" key={item}>
                    <img
                      src={`/images/${item}.jpg`}
                      alt={item}
                      className="cart-image"
                    />
                    <div className="cart-details">
                      <span className="cart-item-name">
                        {item.toUpperCase()}
                      </span>
                      <span className="cart-item-qty">Qty: {qty}</span>
                      <span className="cart-item-price">
                        Price: ${itemPrices[item] * qty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={generateInvoice} className="invoice-btn">
                📄 Download Invoice (PDF)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
