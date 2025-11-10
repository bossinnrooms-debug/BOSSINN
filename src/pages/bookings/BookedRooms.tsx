import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, addDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { format } from 'date-fns';
import { Loader, Calendar, Phone, UserIcon, CreditCard, ShoppingBag } from 'lucide-react';
import { toast } from 'react-toastify';
import { ShopPurchaseService } from '../shop/ShopPurchaseService';

type Room = {
  id: string;
  roomNumber: number;
  isOccupied: boolean;
};

type Customer = {
  id: string;
  guestName: string;
  phoneNumber: string;
  checkedInAt: Timestamp;
  checkedOutAt: Timestamp;
  rent: number;
  isCheckedOut: boolean;
  roomId: string;
};

type PaymentEntry = {
  id: string;
  amount: number;
  mode: string;
  type: string;
  timestamp: any;
  description?: string;
};

type ShopPurchase = {
  id: string;
  inventoryId: string;
  itemName: string;
  quantity: number;
  amount: number;
  createdAt: any;
  paymentStatus: string;
};

type SelectedCustomer = {
  customer: Customer;
  transactions: PaymentEntry[];
};

const BookedRooms: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<PaymentEntry[]>([]);
  const [shopPurchases, setShopPurchases] = useState<ShopPurchase[]>([]);
  const [activeTab, setActiveTab] = useState<'payments' | 'purchases'>('payments');

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchCustomers(selectedRoom);
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const roomsCollection = collection(db, 'rooms');
      const roomsSnapshot = await getDocs(roomsCollection);
      
      const roomsList: Room[] = [];
      roomsSnapshot.forEach((doc) => {
        const data = doc.data();
        roomsList.push({
          id: doc.id,
          roomNumber: data.roomNumber || 0,
          isOccupied: data.status === 'occupied' || false
        });
      });
      
      roomsList.sort((a, b) => a.roomNumber - b.roomNumber);
      setRooms(roomsList);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (roomId: string) => {
    try {
      const checkinsRef = collection(db, 'checkins');
      const q = query(checkinsRef, where('roomId', '==', roomId), where('isCheckedOut', '==', true));
      const querySnapshot = await getDocs(q);
      
      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({
          id: doc.id,
          guestName: data.guestName || 'Unknown Guest',
          phoneNumber: data.phoneNumber || 'N/A',
          checkedInAt: data.checkedInAt,
          checkedOutAt: data.checkedOutAt,
          rent: data.rent || 0,
          isCheckedOut: data.isCheckedOut || false,
          roomId: data.roomId
        });
      });
      
      customersData.sort((a, b) => b.checkedInAt.seconds - a.checkedInAt.seconds);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customer details');
    }
  };

  const fetchPaymentHistory = async (customer: Customer) => {
    try {
      const paymentRef = collection(db, 'checkins', customer.id, 'payments');
      const q = query(paymentRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as PaymentEntry[];

      const rentEntry: PaymentEntry = {
        id: 'rent-entry',
        amount: customer.rent,
        mode: 'n/a',
        type: 'Rent (Check-in)',
        timestamp: customer.checkedInAt || Timestamp.now(),
      };

      const shopPurchases = await ShopPurchaseService.getPurchasesByCheckin(customer.id);
      setShopPurchases(shopPurchases as ShopPurchase[]);

      const initialPayment = history.find(p => p.type === 'initial');
      
      const advanceEntry = initialPayment || {
        id: 'advance-entry',
        amount: customer.rent,
        mode: 'cash',
        type: 'initial',
        timestamp: customer.checkedInAt || Timestamp.now(),
        description: 'Initial payment at check-in'
      };

      const fullHistory = [rentEntry, advanceEntry, ...history.filter(p => p.type !== 'initial')];
      setPaymentHistory(fullHistory);
      setSelectedCustomer({ customer, transactions: fullHistory });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to fetch payment history');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;
    
    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }
      
      await addDoc(collection(db, 'checkins', selectedCustomer.customer.id, 'payments'), {
        amount,
        mode: 'cash',
        type: 'advance',
        timestamp: Timestamp.now(),
        description: 'Payment added for checked-out guest'
      });
      
      toast.success('Payment added successfully');
      setShowPaymentModal(false);
      setPaymentAmount('');
      
      await fetchPaymentHistory(selectedCustomer.customer);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Failed to add payment');
    }
  };

  const getTotalShopPurchases = () => {
    return shopPurchases.reduce((total, purchase) => total + purchase.amount, 0);
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp || !timestamp.toDate) return '—';
    return format(timestamp.toDate(), 'dd MMM yyyy h:mm a');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Room History</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Rooms List */}
        <div className="md:col-span-3 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">Rooms</h2>
          <div className="space-y-2">
            {rooms.length > 0 ? (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoom(room.id);
                    setSelectedCustomer(null);
                  }}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    selectedRoom === room.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-white border-2 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium">Room {room.roomNumber}</div>
                  <div className={`text-sm ${room.isOccupied ? 'text-red-600' : 'text-green-600'}`}>
                    {room.isOccupied ? 'Occupied' : 'Available'}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">No rooms found</div>
            )}
          </div>
        </div>

        {/* Customer List */}
        <div className="md:col-span-4 space-y-4">
          {selectedRoom && (
            <>
              <h2 className="text-lg font-semibold text-gray-700">Customer History</h2>
              <div className="space-y-4">
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => fetchPaymentHistory(customer)}
                      className={`w-full p-4 rounded-lg text-left transition-colors ${
                        selectedCustomer?.customer.id === customer.id
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-white border-2 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-5 w-5 text-gray-500" />
                        <span className="font-medium">{customer.guestName}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4" />
                          <span>{customer.phoneNumber}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Check-in: {formatDate(customer.checkedInAt)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Check-out: {formatDate(customer.checkedOutAt)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4" />
                          <span>Rent: ₹{customer.rent}</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No customer history found
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Transaction History */}
        <div className="md:col-span-5 space-y-4">
          {selectedCustomer && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Transaction History</h2>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Payment
                </button>
              </div>

              <div className="mt-6">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex">
                    <button
                      onClick={() => setActiveTab('payments')}
                      className={`py-2 px-4 text-sm font-medium ${
                        activeTab === 'payments'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Payment History
                    </button>
                    <button
                      onClick={() => setActiveTab('purchases')}
                      className={`py-2 px-4 text-sm font-medium flex items-center ${
                        activeTab === 'purchases'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Shop Purchases
                      {shopPurchases.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {shopPurchases.length}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>

                {activeTab === 'payments' && (
                  <div className="mt-4">
                    <div className="overflow-auto max-h-64 border rounded">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Time</th>
                            <th className="p-2 text-left">Process</th>
                            <th className="p-2 text-left">Cash</th>
                            <th className="p-2 text-left">Gpay</th>
                            <th className="p-2 text-left">Rent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentHistory.map((entry, i) => {
                            const dt = entry.timestamp?.toDate?.();
                            const date = dt ? new Date(dt).toLocaleDateString('en-IN') : '—';
                            const time = dt ? new Date(dt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—';
                            
                            let process = '';
                            let rentAmount = null;
                            let cashAmount = null;
                            let gpayAmount = null;

                            switch (entry.type) {
                              case 'Rent (Check-in)':
                                process = 'Check-in';
                                rentAmount = entry.amount;
                                break;
                              case 'extension':
                                process = 'Extension';
                                rentAmount = entry.amount;
                                break;
                              case 'initial':
                                process = 'Initial Payment';
                                if (entry.mode === 'cash') cashAmount = entry.amount;
                                if (entry.mode === 'gpay') gpayAmount = entry.amount;
                                break;
                              case 'advance':
                                process = 'Additional Payment';
                                if (entry.mode === 'cash') cashAmount = entry.amount;
                                if (entry.mode === 'gpay') gpayAmount = entry.amount;
                                break;
                            }

                            return (
                              <tr key={i} className="border-t">
                                <td className="p-2">{date}</td>
                                <td className="p-2">{time}</td>
                                <td className="p-2">{process}</td>
                                <td className="p-2">{cashAmount ? `₹${cashAmount.toFixed(2)}` : '—'}</td>
                                <td className="p-2">{gpayAmount ? `₹${gpayAmount.toFixed(2)}` : '—'}</td>
                                <td className="p-2">{rentAmount ? `₹${rentAmount.toFixed(2)}` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'purchases' && (
                  <div className="mt-4">
                    <div className="overflow-auto max-h-64 border rounded">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-200">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Item</th>
                            <th className="p-2 text-left">Quantity</th>
                            <th className="p-2 text-left">Price</th>
                            <th className="p-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shopPurchases.map((purchase, i) => {
                            const dt = purchase.createdAt?.toDate?.();
                            const date = dt ? new Date(dt).toLocaleDateString('en-IN') : '—';
                            
                            return (
                              <tr key={i} className="border-t">
                                <td className="p-2">{date}</td>
                                <td className="p-2 font-medium">{purchase.itemName}</td>
                                <td className="p-2">{purchase.quantity}</td>
                                <td className="p-2">₹{purchase.amount.toFixed(2)}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    purchase.paymentStatus === 'pending' 
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {purchase.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {shopPurchases.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-2 text-center text-gray-500">
                                <div className="flex flex-col items-center py-4">
                                  <ShoppingBag className="h-8 w-8 text-gray-400 mb-2" />
                                  <p>No shop purchases found</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {shopPurchases.length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <div className="bg-gray-100 px-4 py-2 rounded text-sm">
                          <span className="font-medium">Total Shop Purchases:</span> 
                          <span className="ml-2 font-bold">₹{getTotalShopPurchases().toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Payment</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookedRooms;