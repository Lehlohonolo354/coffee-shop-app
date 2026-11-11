import React, { useState, useEffect } from 'react';

// Automatically use Render URL in production or fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://coffee-shop-app-4.onrender.com';

function App() {
  const [view, setView] = useState('customer'); // 'customer' or 'staff'
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- STAFF AUTHENTICATION STATES ---
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const [staffPassword, setStaffPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- ORDER HISTORY FILTER & PRINT SLIP STATES ---
  const [orderTimeFilter, setOrderTimeFilter] = useState('7days'); // 'today', '7days', or 'all'
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState(null);

  // Store Info state
  const [storeInfo, setStoreInfo] = useState({
    name: "Campus Brew & Pastry",
    tagline: "Fresh coffee and treats for students and staff",
    openingHours: "Mon - Fri: 07:30 AM - 17:00 PM",
    location: "Main Student Center",
    contact: "+266 2222 3333"
  });

  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', image: '' });
  const [orders, setOrders] = useState([]);

  // Fetch store info, menu, & orders from Express backend using dynamic base URL
  const fetchData = () => {
    fetch(`${API_BASE_URL}/api/store-info`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setStoreInfo(data);
      })
      .catch(err => console.error("Error fetching store info:", err));

    fetch(`${API_BASE_URL}/api/menu`)
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error("Error fetching menu:", err));

    fetch(`${API_BASE_URL}/api/orders`)
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => console.error("Error fetching orders:", err));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LIVE ORDER STATUS POLLING FOR CUSTOMER VIEW ---
  useEffect(() => {
    if (!activeOrder || !activeOrder.id) return;

    const intervalId = setInterval(() => {
      fetch(`${API_BASE_URL}/api/orders/${activeOrder.id}`)
        .then(res => res.json())
        .then(updatedOrder => {
          if (updatedOrder && updatedOrder.status) {
            setActiveOrder(prev => ({ ...prev, status: updatedOrder.status }));
          }
        })
        .catch(err => console.error("Error polling order status:", err));
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeOrder?.id, API_BASE_URL]);

  // --- CUSTOMER PORTAL LOGIC ---
  const addToCart = (item) => {
    setCart(prevCart => {
      const existing = prevCart.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean)
    );
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
  };

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    if (!customerName.trim() || cart.length === 0) return;
    setLoading(true);

    const orderPayload = {
      customerName,
      items: cart,
      totalAmount: parseFloat(calculateTotal())
    };

    fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    })
      .then(res => res.json())
      .then(orderData => {
        setActiveOrder(orderData);
        setCart([]);
        setCustomerName('');
        setLoading(false);
        fetchData();
      })
      .catch(err => {
        console.error("Error placing order:", err);
        setLoading(false);
      });
  };

  // --- STAFF LOGIN HANDLER ---
  const handleStaffLogin = (e) => {
    e.preventDefault();
    if (staffPassword === 'admin123') {
      setIsStaffAuthenticated(true);
      setLoginError('');
      setStaffPassword('');
    } else {
      setLoginError('Incorrect staff password. Access denied.');
    }
  };

  const handleStaffLogout = () => {
    setIsStaffAuthenticated(false);
  };

  // --- STAFF DASHBOARD LOGIC ---
  const handleAddMenuItem = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    })
      .then(res => res.json())
      .then(() => {
        setNewItem({ name: '', description: '', price: '', image: '' });
        fetchData();
      })
      .catch(err => console.error("Error adding item:", err));
  };

  const handleDeleteMenuItem = (id) => {
    fetch(`${API_BASE_URL}/api/menu/${id}`, { method: 'DELETE' })
      .then(() => fetchData())
      .catch(err => console.error("Error deleting item:", err));
  };

  const handleUpdateStatus = (orderId, status) => {
    fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then(() => fetchData())
      .catch(err => console.error("Error updating order status:", err));
  };

  const handleClearExpiredOrders = () => {
    if (!window.confirm("Are you sure you want to delete uncollected orders older than 24 hours?")) return;
    
    fetch(`${API_BASE_URL}/api/orders/clear-expired`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
        fetchData();
      })
      .catch(err => console.error("Error clearing expired orders:", err));
  };

  const getFilteredOrders = () => {
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    return orders.filter(order => {
      const orderTime = new Date(order.createdAt).getTime();
      if (orderTimeFilter === 'today') {
        return (now - orderTime) <= oneDayMs;
      } else if (orderTimeFilter === '7days') {
        return (now - orderTime) <= sevenDaysMs;
      }
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1150px', margin: '0 auto', padding: '20px', backgroundColor: '#f5f2eb', minHeight: '100vh' }}>
      
      {/* Top Header Navigation */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '25px' }}>
        <div>
          <h1 style={{ color: '#4a2c2a', margin: 0, fontSize: '24px' }}>☕ {storeInfo.name}</h1>
          {storeInfo.openingHours && (
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
              🕒 {storeInfo.openingHours} | 📍 {storeInfo.location}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setView('customer')}
            style={{ padding: '10px 18px', backgroundColor: view === 'customer' ? '#4a2c2a' : '#e0e0e0', color: view === 'customer' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🛍️ Customer Portal
          </button>
          <button 
            onClick={() => setView('staff')}
            style={{ padding: '10px 18px', backgroundColor: view === 'staff' ? '#4a2c2a' : '#e0e0e0', color: view === 'staff' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🛠️ Staff Dashboard
          </button>
        </div>
      </header>

      {/* ================= CUSTOMER VIEW ================= */}
      {view === 'customer' && (
        <div>
          <div style={{ 
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url("https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#fff',
            padding: '45px 25px',
            borderRadius: '12px',
            marginBottom: '30px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '32px', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>Welcome to {storeInfo.name} ☕</h2>
            <p style={{ margin: '0 0 15px 0', fontSize: '16px', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{storeInfo.tagline}</p>
            <span style={{ backgroundColor: '#d35400', color: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
              ✨ Freshly Brewed Daily on Campus
            </span>
          </div>

          {activeOrder && (
            <div style={{ 
              backgroundColor: activeOrder.status === 'Ready' ? '#d4edda' : '#e8f5e9', 
              border: `1px solid ${activeOrder.status === 'Ready' ? '#28a745' : '#a5d6a7'}`, 
              padding: '20px', 
              borderRadius: '10px', 
              marginBottom: '30px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{ color: activeOrder.status === 'Ready' ? '#155724' : '#2e7d32', marginTop: 0 }}>
                {activeOrder.status === 'Ready' ? '🎉 Your Order is Ready for Pickup!' : '🎉 Order Confirmed!'}
              </h2>
              <p>Thank you, <strong>{activeOrder.customerName}</strong>! Your order is being prepared.</p>
              <p style={{ fontSize: '18px' }}>
                <strong>Unique Order Code:</strong> <span style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'monospace' }}>{activeOrder.id}</span>
              </p>
              <p style={{ margin: 0, fontSize: '16px' }}>
                Current Status: <strong style={{ 
                  color: activeOrder.status === 'Ready' ? '#28a745' : '#c0392b',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}>{activeOrder.status}</strong>
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
            <div>
              <h2 style={{ color: '#4a2c2a', borderBottom: '2px solid #e0dcd0', paddingBottom: '8px' }}>Our Menu Catalog</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '15px' }}>
                {menu.map(item => (
                  <div key={item.id} style={{ border: '1px solid #e0dcd0', borderRadius: '10px', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                    {item.image && <img src={item.image} alt={item.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />}
                    <div style={{ padding: '15px' }}>
                      <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>{item.name}</h3>
                      <p style={{ color: '#666', fontSize: '13px', margin: '0 0 10px 0', minHeight: '32px' }}>{item.description}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#27ae60', fontSize: '16px' }}>M{parseFloat(item.price).toFixed(2)}</span>
                        <button 
                          onClick={() => addToCart(item)}
                          disabled={!item.available}
                          style={{ backgroundColor: item.available ? '#4a2c2a' : '#ccc', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: item.available ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                          {item.available ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ border: '1px solid #e0dcd0', borderRadius: '10px', backgroundColor: '#fff', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                <h2 style={{ color: '#4a2c2a', marginTop: 0, borderBottom: '2px solid #e0dcd0', paddingBottom: '8px' }}>🛒 Your Cart</h2>
                {cart.length === 0 ? (
                  <p style={{ color: '#888' }}>Your cart is empty. Pick a treat from our menu!</p>
                ) : (
                  <div>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px' }}>{item.name}</h4>
                          <span style={{ fontSize: '12px', color: '#666' }}>M{Number(item.price).toFixed(2)} x {item.quantity}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '25px', height: '25px', cursor: 'pointer' }}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '25px', height: '25px', cursor: 'pointer' }}>+</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '15px', borderTop: '2px solid #333', paddingTop: '10px' }}>
                      <h3 style={{ margin: 0, color: '#2c3e50' }}>Total: M{calculateTotal()}</h3>
                    </div>
                    <form onSubmit={handlePlaceOrder} style={{ marginTop: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Your Name:</label>
                      <input 
                        type="text" 
                        required 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Lehlohonolo" 
                        style={{ width: '100%', padding: '9px', boxSizing: 'border-box', marginBottom: '12px', borderRadius: '6px', border: '1px solid #ccc' }} 
                      />
                      <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '11px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
                        {loading ? 'Placing Order...' : 'Place Order'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= STAFF DASHBOARD (PROTECTED) ================= */}
      {view === 'staff' && (
        <div>
          {!isStaffAuthenticated ? (
            <div style={{ maxWidth: '400px', margin: '40px auto', backgroundColor: '#fff', padding: '30px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <h2>🔒 Staff Portal Login</h2>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Please enter your staff password to access management tools.</p>
              
              <form onSubmit={handleStaffLogin}>
                <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Password:</label>
                  <input 
                    type="password" 
                    required 
                    value={staffPassword} 
                    onChange={e => setStaffPassword(e.target.value)} 
                    placeholder="Enter password (admin123)" 
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
                  />
                </div>
                {loginError && <p style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '15px' }}>{loginError}</p>}
                <button type="submit" style={{ width: '100%', backgroundColor: '#4a2c2a', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Login to Dashboard
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>📅 Timeframe:</span>
                  <button 
                    onClick={() => setOrderTimeFilter('today')}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: orderTimeFilter === 'today' ? '#4a2c2a' : '#fff', color: orderTimeFilter === 'today' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    Today
                  </button>
                  <button 
                    onClick={() => setOrderTimeFilter('7days')}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: orderTimeFilter === '7days' ? '#4a2c2a' : '#fff', color: orderTimeFilter === '7days' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    Last 7 Days
                  </button>
                  <button 
                    onClick={() => setOrderTimeFilter('all')}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: orderTimeFilter === 'all' ? '#4a2c2a' : '#fff', color: orderTimeFilter === 'all' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    All History
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleClearExpiredOrders} style={{ padding: '8px 12px', backgroundColor: '#e67e22', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    🧹 Clear Uncollected (&gt;24h)
                  </button>
                  <button 
                    onClick={handleStaffLogout}
                    style={{ backgroundColor: '#7f8c8d', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    🔒 Logout
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Orders ({orderTimeFilter})</h4>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#2c3e50' }}>{filteredOrders.length}</p>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Revenue ({orderTimeFilter})</h4>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#27ae60' }}>M{totalRevenue}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', height: 'fit-content' }}>
                  <h2>➕ Add New Menu Item</h2>
                  <form onSubmit={handleAddMenuItem}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Item Name</label>
                      <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g., Green Tea" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Description</label>
                      <input type="text" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Short description" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Price (M)</label>
                      <input type="number" step="0.01" required value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} placeholder="25.00" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Image URL</label>
                      <input type="text" value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} placeholder="https://..." style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <button type="submit" style={{ width: '100%', backgroundColor: '#4a2c2a', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Add Item to Menu
                    </button>
                  </form>

                  <h3 style={{ marginTop: '25px' }}>Manage Inventory</h3>
                  <ul style={{ paddingLeft: '15px', margin: 0, fontSize: '14px' }}>
                    {menu.map(m => (
                      <li key={m.id} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{m.name} (M{Number(m.price).toFixed(2)})</span>
                        <button onClick={() => handleDeleteMenuItem(m.id)} style={{ backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
                  <h2>📋 Order Management & History</h2>
                  {filteredOrders.length === 0 ? (
                    <p style={{ color: '#888' }}>No orders recorded for this timeframe.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {filteredOrders.slice().reverse().map(order => (
                        <div key={order.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fafafa' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#c0392b' }}>{order.id}</span>
                            <span style={{ fontSize: '12px', color: '#666' }}>{new Date(order.createdAt).toLocaleString()}</span>
                          </div>
                          <p style={{ margin: '0 0 8px 0' }}><strong>Customer:</strong> {order.customerName}</p>
                          <div style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#555' }}>
                            <strong>Items Ordered:</strong>
                            <ul style={{ margin: '4px 0 0 15px', padding: 0 }}>
                              {order.items.map((i, idx) => (
                                <li key={idx}>{i.name} (x{i.quantity}) - M{(i.price * i.quantity).toFixed(2)}</li>
                              ))}
                            </ul>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 'bold' }}>Total: M{Number(order.totalAmount).toFixed(2)}</span>
                              <button 
                                onClick={() => setSelectedOrderForSlip(order)}
                                style={{ padding: '4px 8px', backgroundColor: '#2980b9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                🖨️ Print Slip
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Status:</span>
                              <select 
                                value={order.status} 
                                onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: order.status === 'Ready' ? '#d4edda' : '#fff' }}>
                                <option value="Pending">Pending</option>
                                <option value="Preparing">Preparing</option>
                                <option value="Ready">Ready</option>
                                <option value="Collected">Collected</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= PRINTABLE CUSTOMER SLIP / RECEIPT MODAL ================= */}
      {selectedOrderForSlip && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', width: '320px', padding: '25px', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>☕ {storeInfo.name}</h2>
              <p style={{ margin: '3px 0', fontSize: '12px' }}>{storeInfo.location}</p>
              <p style={{ margin: '3px 0', fontSize: '11px' }}>{storeInfo.contact}</p>
              <h3 style={{ margin: '10px 0 0 0', fontSize: '14px', textTransform: 'uppercase' }}>Customer Collection Slip</h3>
            </div>

            <div style={{ fontSize: '12px', marginBottom: '15px' }}>
              <p style={{ margin: '3px 0' }}><strong>Order Code:</strong> {selectedOrderForSlip.id}</p>
              <p style={{ margin: '3px 0' }}><strong>Date:</strong> {new Date(selectedOrderForSlip.createdAt).toLocaleString()}</p>
              <p style={{ margin: '3px 0' }}><strong>Customer:</strong> {selectedOrderForSlip.customerName}</p>
              <p style={{ margin: '3px 0' }}><strong>Status:</strong> {selectedOrderForSlip.status}</p>
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0', marginBottom: '15px', fontSize: '12px' }}>
              <table style={{ width: '100%', textIndent: 0 }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderForSlip.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>x{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>M{(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', fontSize: '14px', marginBottom: '20px' }}>
              <strong>TOTAL AMOUNT: M{Number(selectedOrderForSlip.totalAmount).toFixed(2)}</strong>
            </div>

            <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', marginBottom: '15px' }}>
              <p style={{ margin: 0 }}>Thank you for visiting {storeInfo.name}!</p>
              <p style={{ margin: '2px 0 0 0' }}>Please present this slip upon collection.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => window.print()}
                style={{ flex: 1, backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                🖨️ Print
              </button>
              <button 
                onClick={() => setSelectedOrderForSlip(null)}
                style={{ flex: 1, backgroundColor: '#c0392b', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;