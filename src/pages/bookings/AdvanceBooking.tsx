import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { Calendar, Users, CreditCard, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

type Room = {
  id: string;
  roomNumber: number;
  floor: string;
  type: string;
  status: string;
};

type RoomDetail = {
  roomId: string;
  roomNumber: number;
  price: number;
  persons: number;
};

const AdvanceBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [showRoomSelection, setShowRoomSelection] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<RoomDetail[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    aadhar: '',
    dateOfBooking: '',
    roomType: 'NON AC',
    numberOfRooms: 1,
    advanceAmount: '',
    paymentMode: 'cash' as 'cash' | 'gpay'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfRooms' ? parseInt(value) || 1 : value,
    }));
  };

  const checkAvailability = async () => {
    if (!formData.dateOfBooking) {
      toast.error('Please select a booking date');
      return;
    }

    setLoading(true);
    try {
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const allRooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];

      const bookingsQuery = query(
        collection(db, 'advance_bookings'),
        where('date_of_booking', '==', formData.dateOfBooking),
        where('status', '==', 'active')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      const bookedRoomIds = new Set<string>();
      bookingsSnapshot.docs.forEach(doc => {
        const rooms = doc.data().rooms || [];
        rooms.forEach((room: RoomDetail) => {
          bookedRoomIds.add(room.roomId);
        });
      });

      const checkinsQuery = query(
        collection(db, 'checkins'),
        where('isCheckedOut', '==', false)
      );
      const checkinsSnapshot = await getDocs(checkinsQuery);
      checkinsSnapshot.docs.forEach(doc => {
        bookedRoomIds.add(doc.data().roomId);
      });

      const availableRoomsList = allRooms.filter(room =>
        !bookedRoomIds.has(room.id) &&
        room.status === 'available' &&
        room.type.toLowerCase().includes(formData.roomType.toLowerCase().replace(' ', '-'))
      );

      availableRoomsList.sort((a, b) => a.roomNumber - b.roomNumber);

      setAvailableRooms(availableRoomsList);
      setShowRoomSelection(true);

      if (availableRoomsList.length === 0) {
        toast.warning('No rooms available for the selected date and type');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Failed to check room availability');
    } finally {
      setLoading(false);
    }
  };

  const handleRoomSelect = (room: Room) => {
    if (selectedRooms.find(r => r.roomId === room.id)) {
      toast.info('Room already selected');
      return;
    }

    if (selectedRooms.length >= formData.numberOfRooms) {
      toast.warning(`You can only select ${formData.numberOfRooms} room(s)`);
      return;
    }

    const newRoom: RoomDetail = {
      roomId: room.id,
      roomNumber: room.roomNumber,
      price: 0,
      persons: 1
    };

    setSelectedRooms(prev => [...prev, newRoom]);
  };

  const handleRoomDetailChange = (roomId: string, field: 'price' | 'persons', value: number) => {
    setSelectedRooms(prev => prev.map(room =>
      room.roomId === roomId ? { ...room, [field]: value } : room
    ));
  };

  const removeSelectedRoom = (roomId: string) => {
    setSelectedRooms(prev => prev.filter(room => room.roomId !== roomId));
  };

  const getTotalAmount = () => {
    return selectedRooms.reduce((total, room) => total + room.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRooms.length === 0) {
      toast.error('Please select at least one room');
      return;
    }

    if (selectedRooms.length !== formData.numberOfRooms) {
      toast.error(`Please select exactly ${formData.numberOfRooms} room(s)`);
      return;
    }

    if (selectedRooms.some(room => room.price <= 0)) {
      toast.error('Please enter price for all selected rooms');
      return;
    }

    if (!formData.name || !formData.mobile || !formData.aadhar || !formData.dateOfBooking || !formData.advanceAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const advanceAmount = parseFloat(formData.advanceAmount);

      await addDoc(collection(db, 'advance_bookings'), {
        name: formData.name,
        mobile: formData.mobile,
        aadhar: formData.aadhar,
        date_of_booking: formData.dateOfBooking,
        room_type: formData.roomType,
        number_of_rooms: formData.numberOfRooms,
        advance_amount: advanceAmount,
        payment_mode: formData.paymentMode,
        rooms: selectedRooms,
        status: 'active',
        created_at: Timestamp.now(),
        cancelled_at: null,
        refund_amount: 0
      });

      await addDoc(collection(db, 'payments'), {
        type: 'advance',
        amount: advanceAmount,
        mode: formData.paymentMode,
        paymentMode: formData.paymentMode,
        customer_name: formData.name,
        date_of_booking: formData.dateOfBooking,
        rooms: selectedRooms.map(r => r.roomNumber).join(', '),
        note: `Advance booking payment for ${formData.name} on ${formData.dateOfBooking}`,
        timestamp: Timestamp.now(),
        paymentStatus: 'completed',
        description: `Advance payment for ${formData.numberOfRooms} room(s)`,
        roomNumber: selectedRooms.map(r => r.roomNumber).join(', ')
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="NON AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Rooms
                  </label>
                  <input
                    type="number"
                    name="numberOfRooms"
                    min="1"
                    value={formData.numberOfRooms}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="gpay">GPay</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  type="button"
                  onClick={checkAvailability}
                  disabled={loading || !formData.dateOfBooking}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Check Availability
                </button>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate('/advance-bookings')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || selectedRooms.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {loading ? 'Processing...' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
            <h2 className="text-xl font-semibold mb-4">Selected Rooms</h2>

            {selectedRooms.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm">No rooms selected yet</p>
                <p className="text-gray-400 text-xs mt-2">
                  Click "Check Availability" to select rooms
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {selectedRooms.map((room) => (
                    <div key={room.roomId} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-medium text-lg">Room {room.roomNumber}</div>
                        <button
                          onClick={() => removeSelectedRoom(room.roomId)}
                          className="p-1 rounded-full hover:bg-red-100 text-red-600 transition-colors duration-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Number of Persons
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={room.persons}
                            onChange={(e) => handleRoomDetailChange(room.roomId, 'persons', parseInt(e.target.value) || 1)}
                            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Room Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={room.price || ''}
                            onChange={(e) => handleRoomDetailChange(room.roomId, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Enter price"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Room Price:</span>
                    <span className="font-semibold">₹{getTotalAmount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Advance Amount:</span>
                    <span className="font-semibold text-green-600">
                      ₹{parseFloat(formData.advanceAmount || '0').toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-base pt-2 border-t">
                    <span>Remaining Balance:</span>
                    <span className="text-blue-600">
                      ₹{(getTotalAmount() - parseFloat(formData.advanceAmount || '0')).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRoomSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowRoomSelection(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Available Rooms</h2>
                  <button
                    onClick={() => setShowRoomSelection(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  >
                    <X className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {availableRooms.length} rooms available | Selected: {selectedRooms.length}/{formData.numberOfRooms}
                </p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {availableRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Rooms Available</h3>
                    <p className="text-gray-500">
                      All rooms are booked for the selected date and type.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {availableRooms.map((room) => {
                      const isSelected = selectedRooms.some(r => r.roomId === room.id);
                      return (
                        <button
                          key={room.id}
                          onClick={() => !isSelected && handleRoomSelect(room)}
                          disabled={isSelected}
                          className={`p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                            isSelected
                              ? 'border-green-500 bg-green-50 cursor-not-allowed'
                              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <div className="text-2xl font-bold mb-1">{room.roomNumber}</div>
                          <div className="text-xs text-gray-600">Floor {room.floor}</div>
                          <div className="text-xs text-gray-600 capitalize">{room.type}</div>
                          {isSelected && (
                            <div className="mt-2 text-xs font-medium text-green-600">Selected</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowRoomSelection(false)}
                  className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvanceBooking;
