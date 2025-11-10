import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BedDouble, 
  Grid3X3, 
  Users, 
  ShoppingBag, 
  Package, 
  Receipt, 
  LogOut,
  TrendingUp,
  Calendar,
  DollarSign,
  Wallet,
  CreditCard
} from 'lucide-react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const features = [
  { icon: BedDouble, label: 'Rooms', path: '/rooms', color: 'bg-blue-500' },
  { icon: Grid3X3, label: 'Room Matrix', path: '/rooms/matrix', color: 'bg-indigo-500' },
  { icon: Users, label: 'Booked Rooms', path: '/booked-rooms', color: 'bg-purple-500' },
  { icon: ShoppingBag, label: 'Shop', path: '/shop', color: 'bg-pink-500' },
  { icon: Package, label: 'Inventory', path: '/inventory', color: 'bg-yellow-500' },
  { icon: Receipt, label: 'Payment Logs', path: '/payments', color: 'bg-green-500' },
  { icon: LogOut, label: 'Checkout', path: '/checkout', color: 'bg-red-500' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roomStats, setRoomStats] = useState({
    total: 0,
    occupied: 0,
    available: 0,
    cleaning: 0,
    maintenance: 0
  });
  const [paymentStats, setPaymentStats] = useState({
    todayCash: 0,
    todayGpay: 0,
    weekCash: 0,
    weekGpay: 0,
    monthCash: 0,
    monthGpay: 0
  });
  const [dailyRevenue, setDailyRevenue] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch room statistics
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const roomStats = {
        total: 0,
        occupied: 0,
        available: 0,
        cleaning: 0,
        maintenance: 0
      };
      
      roomsSnapshot.forEach(doc => {
        roomStats.total++;
        const status = doc.data().status;
        if (status === 'occupied') roomStats.occupied++;
        else if (status === 'available') roomStats.available++;
        else if (status === 'cleaning') roomStats.cleaning++;
        else if (status === 'maintenance') roomStats.maintenance++;
      });
      
      setRoomStats(roomStats);

      // Fetch payment statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const stats = {
        todayCash: 0,
        todayGpay: 0,
        weekCash: 0,
        weekGpay: 0,
        monthCash: 0,
        monthGpay: 0
      };

      const dailyStats = Array(7).fill(null).map((_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          cash: 0,
          gpay: 0
        };
      }).reverse();

      const checkinsSnapshot = await getDocs(collection(db, 'checkins'));
      
      for (const checkinDoc of checkinsSnapshot.docs) {
        const paymentsSnapshot = await getDocs(collection(db, 'checkins', checkinDoc.id, 'payments'));
        
        paymentsSnapshot.docs.forEach(payDoc => {
          const payment = payDoc.data();
          const paymentDate = payment.timestamp?.toDate();
          if (!paymentDate) return;

          const amount = parseFloat(payment.amount) || 0;
          const isToday = paymentDate >= today;
          const isThisWeek = paymentDate >= weekStart;
          const isThisMonth = paymentDate >= monthStart;

          // Update daily stats
          const dayIndex = dailyStats.findIndex(day => {
            const statsDate = new Date(today);
            statsDate.setDate(statsDate.getDate() - (6 - dailyStats.indexOf(day)));
            return (
              paymentDate.getDate() === statsDate.getDate() &&
              paymentDate.getMonth() === statsDate.getMonth() &&
              paymentDate.getFullYear() === statsDate.getFullYear()
            );
          });

          if (dayIndex !== -1) {
            if (payment.mode === 'cash' || payment.paymentMode === 'cash') {
              dailyStats[dayIndex].cash += amount;
            } else if (payment.mode === 'gpay' || payment.paymentMode === 'gpay') {
              dailyStats[dayIndex].gpay += amount;
            }
          }

          // Update period stats
          if (payment.mode === 'cash' || payment.paymentMode === 'cash') {
            if (isToday) stats.todayCash += amount;
            if (isThisWeek) stats.weekCash += amount;
            if (isThisMonth) stats.monthCash += amount;
          } else if (payment.mode === 'gpay' || payment.paymentMode === 'gpay') {
            if (isToday) stats.todayGpay += amount;
            if (isThisWeek) stats.weekGpay += amount;
            if (isThisMonth) stats.monthGpay += amount;
          }
        });
      }

      setPaymentStats(stats);
      setDailyRevenue(dailyStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Today's Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Today's Cash</p>
                  <p className="text-2xl font-bold text-green-600">₹{paymentStats.todayCash.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Today's GPay</p>
                  <p className="text-2xl font-bold text-blue-600">₹{paymentStats.todayGpay.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 mr-4">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Today's Total</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ₹{(paymentStats.todayCash + paymentStats.todayGpay).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Revenue Chart */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Weekly Revenue</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`₹${value.toFixed(2)}`, 'Amount']}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Bar dataKey="cash" name="Cash" fill="#10B981" />
                  <Bar dataKey="gpay" name="GPay" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            {features.map(({ icon: Icon, label, path, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
              >
                <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mb-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </button>
            ))}
          </div>

          {/* Period Summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Weekly Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cash Collections</span>
                  <span className="font-semibold text-green-600">₹{paymentStats.weekCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">GPay Collections</span>
                  <span className="font-semibold text-blue-600">₹{paymentStats.weekGpay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium text-gray-600">Total Collections</span>
                  <span className="font-bold text-purple-600">
                    ₹{(paymentStats.weekCash + paymentStats.weekGpay).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Monthly Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cash Collections</span>
                  <span className="font-semibold text-green-600">₹{paymentStats.monthCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">GPay Collections</span>
                  <span className="font-semibold text-blue-600">₹{paymentStats.monthGpay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium text-gray-600">Total Collections</span>
                  <span className="font-bold text-purple-600">
                    ₹{(paymentStats.monthCash + paymentStats.monthGpay).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
