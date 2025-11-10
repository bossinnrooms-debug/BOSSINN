import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomList from './pages/rooms/RoomList';
import RoomMatrix from './pages/rooms/RoomMatrix';
import AddRoom from './pages/rooms/AddRoom';
import EditRoom from './pages/rooms/EditRoom';
import CheckIn from './pages/bookings/CheckIn';
//import Checkout from './pages/bookings/Checkout';
import Inventory from './pages/inventory/Inventory';
import AddInventory from './pages/inventory/AddInventory';
import PaymentLogs from './pages/payments/PaymentsPage';
import Shop from './pages/shop/Shop';
import BookedRooms from './pages/bookings/BookedRooms';
// Auth
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="rooms" element={<RoomList />} />
            <Route path="rooms/matrix" element={<RoomMatrix />} />
            <Route path="rooms/add" element={<AddRoom />} />
            <Route path="rooms/edit/:roomId" element={<EditRoom />} />
            <Route path="booked-rooms" element={<BookedRooms />} />
            <Route path="check-in/:roomId" element={<CheckIn />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/add" element={<AddInventory />} />
            <Route path="shop" element={<Shop />} />
            <Route path="payments" element={<PaymentLogs />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </Router>
    </AuthProvider>
  );
}

export default App;