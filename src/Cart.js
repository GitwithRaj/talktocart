import "./Cart.css";

function Cart({ cart, itemPrices, generateInvoice, onBack }) {
  return (
    <div className="cart-fullscreen">
      <nav className="cart-navbar">
        <div className="cart-navbar-left">
          <h1>🛍️ TalkToCart</h1>
        </div>
        <div className="cart-navbar-right">
          <button className="back-btn" onClick={onBack}>
            ⬅ Back to Shop
          </button>
        </div>
      </nav>

      <h2>🛒 Your Cart</h2>
      {Object.keys(cart).length === 0 ? (
        <p>🪶 Your cart is empty.</p>
      ) : (
        <>
          <div className="cart-items">
            {Object.entries(cart).map(([item, qty]) => (
              <div className="cart-card" key={item}>
                <img
                  src={`${process.env.PUBLIC_URL}/images/${item}.jpg`}
                  alt={item}
                  className="cart-image"
                />
                <div className="cart-details">
                  <span className="cart-item-name">{item.toUpperCase()}</span>
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
  );
}

export default Cart;
