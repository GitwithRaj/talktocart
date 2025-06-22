import { useState } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      // Handle Add
      for (const [item, qty] of Object.entries(filterItems(add))) {
        const currentQty = updatedCart[item] || 0;
        const newQty = currentQty + qty;
        if (newQty > MAX_ITEM_QTY) {
          const allowedQty = MAX_ITEM_QTY - currentQty;
          if (allowedQty > 0) {
            updatedCart[item] = currentQty + allowedQty;
            newError += `⚠️ Only ${allowedQty} ${item}(s) added. Max limit is ${MAX_ITEM_QTY}.\n`;
          } else {
            newError += `❌ Cannot add more than ${MAX_ITEM_QTY} ${item}s.\n`;
          }
          continue;
        }

        updatedCart[item] = newQty;
      }

      // Handle Remove
      for (const [item, qty] of Object.entries(filterItems(remove))) {
        const currentQty = updatedCart[item] || 0;
        if (currentQty === 0) {
          newError += `❌ Cannot remove ${item} — not in cart.\n`;
          continue;
        }
        const newQty = Math.max(0, currentQty - qty);
        if (newQty === 0) delete updatedCart[item];
        else updatedCart[item] = newQty;
      }

      setError(newError.trim());
      if (message) setError(message);
      return updatedCart;
    });
  };

  const handlePrompt = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, cart }),
      });

      const data = await res.json();
      const { add = {}, remove = {}, message } = data;

      // ✅ show LLM message

      updateCart(add, remove, message);
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
    else updateCart({}, { [item]: 1 });
  };

  return (
    // <div className="App">
    //   <h1>🛍️ TalkToCart: Fashion Edition</h1>

    //   <div className="prompt-section">
    //     <input
    //       value={prompt}
    //       onChange={(e) => setPrompt(e.target.value)}
    //       placeholder="e.g., Add 2 shirts and remove 1 jacket"
    //     />
    //     <button onClick={handlePrompt} disabled={loading}>
    //       {loading ? "..." : "Submit"}
    //     </button>
    //   </div>
    //   {error && (
    //     <div className="error">
    //       <button className="dismiss-btn" onClick={() => setError("")}>
    //         ✖
    //       </button>
    //       <pre className="error-msg">{error}</pre>
    //     </div>
    //   )}
    //   <div className="manual-section">
    //     <h3>Clothing Items</h3>
    //     {allowedItems.map((item) => (
    //       <div key={item} className="item-buttons">
    //         <span>{item}</span>
    //         <button onClick={() => handleManual(item, "add")}>+</button>
    //         <button onClick={() => handleManual(item, "remove")}>−</button>
    //       </div>
    //     ))}
    //   </div>

    //   <div className="cart">
    //     <h2>Your Cart</h2>
    //     {Object.keys(cart).length === 0 ? (
    //       <p>Empty</p>
    //     ) : (
    //       <ul>
    //         {Object.entries(cart).map(([item, qty]) => (
    //           <li key={item}>
    //             {item}: {qty}
    //           </li>
    //         ))}
    //       </ul>
    //     )}
    //   </div>
    // </div>
    <div className="App">
      <h1>🛍️ TalkToCart: Fashion Edition</h1>

      <div className="prompt-section">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Add 2 shirts and remove 1 jacket"
        />
        <button onClick={handlePrompt} disabled={loading}>
          {loading ? "..." : "Submit"}
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
            <div className="cart-items">
              {Object.entries(cart).map(([item, qty]) => (
                <div className="cart-card" key={item}>
                  <img
                    src={`/images/${item}.jpg`}
                    alt={item}
                    className="cart-image"
                  />
                  <div className="cart-details">
                    <span className="cart-item-name">{item.toUpperCase()}</span>
                    <span className="cart-item-qty">Qty: {qty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
