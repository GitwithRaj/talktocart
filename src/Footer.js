import React from "react";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-columns">
        <div className="footer-column">
          <h4>About Us</h4>
          <ul>
            <li>
              <a href="#">Our Story</a>
            </li>
            <li>
              <a href="#">Team</a>
            </li>
            <li>
              <a href="#">Careers</a>
            </li>
          </ul>
        </div>
        <div className="footer-column">
          <h4>Help</h4>
          <ul>
            <li>
              <a href="#">FAQs</a>
            </li>
            <li>
              <a href="#">Support</a>
            </li>
            <li>
              <a href="#">Returns</a>
            </li>
          </ul>
        </div>
        <div className="footer-column">
          <h4>Contact</h4>
          <ul>
            <li>
              <a href="#">Email Us</a>
            </li>
            <li>
              <a href="#">+91-9999999999</a>
            </li>
            <li>
              <a href="#">Live Chat</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        © 2025 TalkToCart. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
