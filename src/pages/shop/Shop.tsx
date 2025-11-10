import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ShoppingBag, Plus, Minus, ShoppingCart, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ShopPurchaseService } from './ShopPurchaseService';
import { motion, AnimatePresence } from 'framer-motion';

type InventoryItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  category: string;
};

type BookedRoom = {
  id: string;
  roomId: string;
  customerName: string;
  roomNumber: number;
};

type CartItem = {
  inventoryId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

const Shop = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [bookedRooms, setBookedRooms] = useState<BookedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    fetchInventoryAndRooms();
  }, []);

  const fetchInventoryAndRooms = async () => {
    try {
      // Fetch inventory items
      const inventoryCollection = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryCollection);
      const inventoryList = inventorySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(item => item.quantity > 0) as InventoryItem[];
      
      // Sort inventory items by category and name
      inventoryList.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.itemName.localeCompare(b.itemName);
      });
      
      setInventoryItems(inventoryList);

      // Fetch checkins (active bookings)
      const checkinsCollection = collection(db, 'checkins');
      const checkinsQuery = query(checkinsCollection, where('isCheckedOut', '==', false));
      const checkinsSnapshot = await getDocs(checkinsQuery);
      
      // Get room details for each checkin
      const bookingsList = await Promise.all(
        checkinsSnapshot.docs.map(async (checkinDoc) => {
          const checkinData = checkinDoc.data();
          const roomDoc = await getDoc(doc(db, 'rooms', checkinData.roomId));
          const roomData = roomDoc.data();
          
          return {
            id: checkinDoc.id,
            roomId: checkinData.roomId,
            customerName: checkinData.guestName,
            roomNumber: roomData?.roomNumber || 0
          };
        })
      );
      
      // Sort rooms by room number
      bookingsList.sort((a, b) => a.roomNumber - b.roomNumber);
      
      setBookedRooms(bookingsList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
      setLoading(false);
    }
  };

  const addToCart = (item: InventoryItem) => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    
    const existingItem = cartItems.find(cartItem => cartItem.inventoryId === item.id);
    
    if (existingItem) {
      if (existingItem.quantity >= item.quantity) {
        toast.error('Cannot add more than available stock');
        return;
      }
      
      setCartItems(cartItems.map(cartItem => 
        cartItem.inventoryId === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 } 
          : cartItem
      ));
      
      // Show a small toast for feedback
      toast.success(`Added ${item.itemName} to cart`, { autoClose: 1000 });
    } else {
      setCartItems([
        ...cartItems,
        {
          inventoryId: item.id,
          itemName: item.itemName,
          quantity: 1,
          unitPrice: item.unitPrice
        }
      ]);
      
      toast.success(`Added ${item.itemName} to cart`, { autoClose: 1000 });
    }
  };

  const removeFromCart = (inventoryId: string) => {
    const existingItem = cartItems.find(item => item.inventoryId === inventoryId);
    
    if (existingItem) {
      if (existingItem.quantity === 1) {
        setCartItems(cartItems.filter(item => item.inventoryId !== inventoryId));
      } else {
        setCartItems(cartItems.map(item => 
          item.inventoryId === inventoryId 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        ));
      }
    }
  };
  
  const removeItemCompletely = (inventoryId: string) => {
    setCartItems(cartItems.filter(item => item.inventoryId !== inventoryId));
  };

  const handleCheckout = async () => {
    if (!selectedRoom || cartItems.length === 0) return;
    
    setProcessingCheckout(true);
    try {
      // Use the ShopPurchaseService to process the purchase
      await ShopPurchaseService.processPurchase(selectedRoom, cartItems);
      
      setPurchaseSuccess(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setPurchaseSuccess(false);
        setCartItems([]);
        setCheckoutModal(false);
        fetchInventoryAndRooms(); // Refresh inventory data
      }, 2000);
      
    } catch (error) {
      console.error('Error processing purchase:', error);
      toast.error('Failed to process purchase');
      setPurchaseSuccess(false);
      setProcessingCheckout(false);
    }
  };

  // Calculate total amount
  const totalAmount = cartItems.reduce(
    (total, item) => total + item.quantity * item.unitPrice, 
    0
  );

  // Get unique categories
  const categories = ['all', ...new Set(inventoryItems.map(item => item.category))].sort();

  // Filter inventory by search term and category
  const filteredInventory = inventoryItems.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Shop</h1>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Room
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select a room</option>
                  {bookedRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.roomNumber} - {room.customerName}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map((item) => {
                  const cartItem = cartItems.find(ci => ci.inventoryId === item.id);
                  const remainingStock = cartItem ? item.quantity - cartItem.quantity : item.quantity;
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-center justify-center mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <h3 className="text-center font-medium mb-1">{item.itemName}</h3>
                      <p className="text-center text-sm text-gray-500 mb-2">{item.category}</p>
                      <p className="text-center font-semibold mb-4">₹{item.unitPrice.toFixed(2)}</p>
                      
                      {cartItem ? (
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-gray-600">
                            In cart: <span className="font-medium">{cartItem.quantity}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Available: <span className="font-medium">{remainingStock}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-center text-sm text-gray-600 mb-2">
                          Available: <span className="font-medium">{item.quantity}</span>
                        </p>
                      )}
                      
                      {cartItem ? (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                          >
                            <Minus className="h-4 w-4 text-gray-600" />
                          </button>
                          <span className="font-medium">{cartItem.quantity}</span>
                          <button
                            onClick={() => addToCart(item)}
                            disabled={remainingStock <= 0}
                            className={`p-1 rounded-md ${
                              remainingStock > 0
                                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            } transition-colors duration-200`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          disabled={!selectedRoom}
                          className={`w-full py-1 rounded-md flex items-center justify-center ${
                            selectedRoom
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-colors duration-200`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add to Cart
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              
              {filteredInventory.length === 0 && (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No items found</h3>
                  <p className="text-gray-500">
                    {searchTerm || filterCategory !== 'all'
                      ? "No items match your search criteria."
                      : "No items available in inventory."}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Cart</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {cartItems.reduce((total, item) => total + item.quantity, 0)} items
                </span>
              </div>
              
              {selectedRoom ? (
                <div className="mb-4 text-sm">
                  <div className="text-gray-600">Selected Room:</div>
                  <div className="font-medium">
                    Room {bookedRooms.find(room => room.id === selectedRoom)?.roomNumber} - 
                    {bookedRooms.find(room => room.id === selectedRoom)?.customerName}
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-md">
                  Please select a room to continue shopping
                </div>
              )}
              
              {cartItems.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                    <AnimatePresence>
                      {cartItems.map((item) => (
                        <motion.div 
                          key={item.inventoryId}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex justify-between items-center border-b pb-3"
                        >
                          <div className="flex-1">
                            <h3 className="font-medium">{item.itemName}</h3>
                            <p className="text-sm text-gray-500">₹{item.unitPrice.toFixed(2)} x {item.quantity}</p>
                            <p className="text-sm font-medium">₹{(item.unitPrice * item.quantity).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center">
                            <div className="flex items-center space-x-2 mr-3">
                              <button
                                onClick={() => removeFromCart(item.inventoryId)}
                                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                              >
                                <Minus className="h-4 w-4 text-gray-600" />
                              </button>
                              <span className="w-6 text-center font-medium">{item.quantity}</span>
                              <button
                                onClick={() => {
                                  const inventoryItem = inventoryItems.find(invItem => invItem.id === item.inventoryId);
                                  if (inventoryItem && item.quantity < inventoryItem.quantity) {
                                    addToCart(inventoryItem);
                                  } else {
                                    toast.error('Cannot add more than available stock');
                                  }
                                }}
                                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                              >
                                <Plus className="h-4 w-4 text-gray-600" />
                              </button>
                            </div>
                            <button
                              onClick={() => removeItemCompletely(item.inventoryId)}
                              className="p-1 rounded-full bg-red-100 hover:bg-red-200 transition-colors duration-200"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between font-medium text-lg">
                      <span>Total:</span>
                      <span>₹{totalAmount.toFixed(2)}</span>
                    </div>
                    
                    <button
                      onClick={() => setCheckoutModal(true)}
                      disabled={!selectedRoom || cartItems.length === 0}
                      className={`w-full py-2 rounded-md ${
                        selectedRoom && cartItems.length > 0
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      } transition-colors duration-200 flex items-center justify-center`}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Checkout Confirmation Modal */}
      {checkoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative"
          >
            {!purchaseSuccess ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Confirm Purchase</h2>
                  <button 
                    onClick={() => setCheckoutModal(false)}
                    className="p-1 rounded-full hover:bg-gray-100"
                    disabled={processingCheckout}
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                
                <div className="border rounded-md mb-4">
                  <div className="bg-gray-50 p-3 rounded-t-md border-b">
                    <p className="font-medium">
                      Room {bookedRooms.find(room => room.id === selectedRoom)?.roomNumber} - 
                      {bookedRooms.find(room => room.id === selectedRoom)?.customerName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {cartItems.reduce((total, item) => total + item.quantity, 0)} items in cart
                    </p>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto p-3">
                    {cartItems.map((item) => (
                      <div key={item.inventoryId} className="flex justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-sm text-gray-500">₹{item.unitPrice.toFixed(2)} × {item.quantity}</p>
                        </div>
                        <p className="font-medium">₹{(item.unitPrice * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between font-medium text-lg mb-6 p-2 bg-blue-50 rounded-md">
                  <span>Total Amount:</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                
                <p className="mb-6 text-sm text-gray-600">
                  This amount will be added to the room bill. The customer will pay for all items at checkout.
                </p>
                
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setCheckoutModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                    disabled={processingCheckout}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={processingCheckout}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  >
                    {processingCheckout ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      'Confirm Purchase'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Purchase Successful!</h2>
                <p className="text-gray-600 mb-4">
                  {cartItems.length} items have been added to the room bill
                </p>
                <div className="text-sm text-gray-500">
                  Redirecting...
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Shop;
