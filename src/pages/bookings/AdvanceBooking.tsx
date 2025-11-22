import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const AdvanceBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    aadhar: '',
    dateOfBooking: '',
    roomType: 'NON AC',
    numberOfRooms: 1,
    pricePerRoom: '',
    advanceAmount: '',
    paymentMode: 'cash' as 'cash' | 'gpay'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfRooms' ? parseInt(value) || 1 : value
    }));
  };

  const getTotalExpectedAmount = () => {
    const pricePerRoom = parseFloat(formData.pricePerRoom) || 0;
    return pricePerRoom * formData.numberOfRooms;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.mobile || !formData.aadhar || !formData.dateOfBooking || !formData.pricePerRoom || !formData.advanceAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const pricePerRoom = parseFloat(formData.pricePerRoom);
    const advanceAmount = parseFloat(formData.advanceAmount);

    if (pricePerRoom <= 0) {
      toast.error('Price per room must be greater than 0');
      return;
    }

    if (advanceAmount <= 0) {
      toast.error('Advance amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'advance_bookings'), {
        name: formData.name,
        mobile: formData.mobile,
        aadhar: formData.aadhar,
        date_of_booking: formData.dateOfBooking,
        room_type: formData.roomType,
        number_of_rooms: formData.numberOfRooms,
        price_per_room: pricePerRoom,
        advance_amount: advanceAmount,
        payment_mode: formData.paymentMode,
        rooms: [],
        status: 'pending',
        created_at: Timestamp.now(),
        cancelled_at: null,
        refund_amount: 0,
        completed_at: null
      });

      await addDoc(collection(db, 'payments'), {
        type: 'advance',
        amount: advanceAmount,
        mode: formData.paymentMode,
        paymentMode: formData.paymentMode,
        customerName: formData.name,
        date_of_booking: formData.dateOfBooking,
        note: `Advance booking payment for ${formData.name} on ${formData.dateOfBooking}`,
        timestamp: Timestamp.now(),
        paymentStatus: 'completed',
        description: `Advance payment for ${formData.numberOfRooms} room(s)`,
        roomNumber: 'Pending Assignment'
      });

      toast.success('Advance booking created successfully!');
      navigate('/advance-bookings');
    } catch (error) {
      console.error('Error creating advance booking:', error);
      toast.error('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Advance Booking</h1>

      <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter guest name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter mobile number"
                    pattern="[0-9]{10}"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aadhar Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="aadhar"
                    value={formData.aadhar}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter Aadhar number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Booking <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBooking"
                    value={formData.dateOfBooking}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Type
                  </label>
                  <select
                    name="roomType"
                    value={formData.roomType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="NON AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Rooms <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="numberOfRooms"
                    min="1"
                    value={formData.numberOfRooms}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price Per Room (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="pricePerRoom"
                    min="0"
                    step="0.01"
                    value={formData.pricePerRoom}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter price per room"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Advance Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="advanceAmount"
                    min="0"
                    step="0.01"
                    value={formData.advanceAmount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter advance amount"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="gpay">GPay</option>
                  </select>
                </div>
              </div>

              {formData.pricePerRoom && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Expected Amount:</span>
                      <span className="font-semibold text-gray-900">₹{getTotalExpectedAmount().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Advance Amount:</span>
                      <span className="font-semibold text-green-600">₹{parseFloat(formData.advanceAmount || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="font-medium text-gray-700">Balance to be Collected:</span>
                      <span className="font-bold text-blue-600">₹{(getTotalExpectedAmount() - parseFloat(formData.advanceAmount || '0')).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => navigate('/advance-bookings')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? 'Processing...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
    </div>
  );
};

export default AdvanceBooking;
