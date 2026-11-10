import React from 'react';
import './Navbar.css'; // Optional styling file

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>☕Matona Coffee Shop And Pastries</h1>
        <p>Freshly brewed happiness every day</p>
      </div>
      <ul className="navbar-links">
        <li><a href="/">Menu</a></li>
        <li><a href="/cart">Cart</a></li>
        <li><a href="/staff">Staff Dashboard</a></li>
      </ul>
    </nav>
  );
}

export default Navbar;