import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { Plus, Calendar, Phone, CreditCard, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

type RoomDetail = {
  roomId: string;
  roomNumber: number;
  price: number;
  persons: number;
};

type AdvanceBooking = {
  id: string;
  name: string;
  mobile: string;
  aadhar: string;
  date_of_booking: string;
  room_type: string;
  number_of_rooms: number;
  advance_amount: number;
  payment_mode?: string;
  rooms: RoomDetail[];
  status: string;
  created_at: any;
  cancelled_at: any;
  refund_amount: number;
  refund_mode?: string;
};

const AdvanceBookingsList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<AdvanceBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<AdvanceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelModal, setCancelModal] = useState<{
    show: boolean;
    booking: AdvanceBooking | null;
  }>({ show: false, booking: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState<'cash' | 'gpay'>('cash');
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [searchQuery, bookings]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const bookingsQuery = query(
        collection(db, 'advance_bookings'),
        orderBy('date_of_booking', 'asc')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsList = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdvanceBooking[];

      setBookings(bookingsList);
      setFilteredBookings(bookingsList);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = bookings.filter(booking =>
      booking.name.toLowerCase().includes(query) ||
      booking.mobile.includes(query) ||
      booking.date_of_booking.includes(query) ||
      booking.rooms.some(room => room.roomNumber.toString().includes(query))
    );

    setFilteredBookings(filtered);
    setCurrentPage(1);
  };

  const handleCancelBooking = (booking: AdvanceBooking) => {
    setCancelModal({ show: true, booking });
    setRefundAmount(booking.advance_amount.toString());
    setRefundMode(booking.payment_mode === 'gpay' ? 'gpay' : 'cash');
  };

  const confirmCancellation = async () => {
    if (!cancelModal.booking) return;

    const refund = parseFloat(refundAmount);
    if (isNaN(refund) || refund < 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    if (refund > cancelModal.booking.advance_amount) {
      toast.error('Refund amount cannot exceed advance amount');
      return;
    }

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'advance_bookings', cancelModal.booking.id), {
        status: 'cancelled',
        cancelled_at: Timestamp.now(),
        refund_amount: refund,
        refund_mode: refundMode
      });

      if (refund > 0) {
        await addDoc(collection(db, 'payments'), {
          type: 'refund',
          amount: -refund,
          mode: refundMode,
          paymentMode: refundMode,
          customer_name: cancelModal.booking.name,
          date_of_booking: cancelModal.booking.date_of_booking,
          rooms: cancelModal.booking.rooms.map(r => r.roomNumber).join(', '),
          note: `Refund for cancelled advance booking - ${cancelModal.booking.name} (${cancelModal.booking.date_of_booking})`,
          timestamp: Timestamp.now(),
          paymentStatus: 'completed',
          description: `Refund via ${refundMode}`,
          roomNumber: cancelModal.booking.rooms.map(r => r.roomNumber).join(', ')
        });
      }

      toast.success('Booking cancelled and refund recorded successfully');
      setCancelModal({ show: false, booking: null });
      setRefundAmount('');
      setRefundMode('cash');
      fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  const getTotalPrice = (rooms: RoomDetail[]) => {
    return rooms.reduce((total, room) => total + room.price, 0);
  };

  const getStatusBadge = (status: string, dateOfBooking: string) => {
    const bookingDate = new Date(dateOfBooking);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status === 'cancelled') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Cancelled</span>;
    }

    if (bookingDate < today) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Past</span>;
    }

    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>;
  };

  const activeBookings = filteredBookings.filter(b => b.status === 'active');
  const cancelledBookings = filteredBookings.filter(b => b.status === 'cancelled');

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBookings = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Advance Bookings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {activeBookings.length} active, {cancelledBookings.length} cancelled
          </p>
        </div>
        <button
          onClick={() => navigate('/advance-booking/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Booking
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, date, or room number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Bookings Found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'No bookings match your search.' : 'Start by creating your first advance booking.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate('/advance-booking/new')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Booking
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rooms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBookings.map((booking, index) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{booking.name}</div>
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          {booking.mobile}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(booking.date_of_booking).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 capitalize">{booking.room_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.rooms.map(r => r.roomNumber).join(', ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {booking.number_of_rooms} room(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Total: ₹{getTotalPrice(booking.rooms).toFixed(2)}
                        </div>
                        <div className="text-xs text-green-600 mt-1 flex items-center">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Advance: ₹{booking.advance_amount.toFixed(2)} ({booking.payment_mode || 'cash'})
                        </div>
                        {booking.status === 'cancelled' && booking.refund_amount > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            Refunded: ₹{booking.refund_amount.toFixed(2)} ({booking.refund_mode || 'cash'})
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(booking.status, booking.date_of_booking)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.status === 'active' && (
                          <button
                            onClick={() => handleCancelBooking(booking)}
                            className="flex items-center text-red-600 hover:text-red-900 transition-colors duration-200"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </button>
                        )}
                        {booking.status === 'cancelled' && (
                          <span className="text-gray-400 text-xs">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredBookings.length)} of{' '}
                {filteredBookings.length} bookings
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {cancelModal.show && cancelModal.booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setCancelModal({ show: false, booking: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Cancel Booking</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Are you sure you want to cancel this booking?
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Guest:</span>
                    <span className="font-medium">{cancelModal.booking.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">
                      {new Date(cancelModal.booking.date_of_booking).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rooms:</span>
                    <span className="font-medium">
                      {cancelModal.booking.rooms.map(r => r.roomNumber).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Advance Paid:</span>
                    <span className="font-medium">₹{cancelModal.booking.advance_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={cancelModal.booking.advance_amount}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    placeholder="Enter refund amount"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum refundable: ₹{cancelModal.booking.advance_amount.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as 'cash' | 'gpay')}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="gpay">GPay</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setCancelModal({ show: false, booking: null });
                    setRefundAmount('');
                  }}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Keep Booking
                </button>
                <button
                  onClick={confirmCancellation}
                  disabled={processing}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvanceBookingsList;
