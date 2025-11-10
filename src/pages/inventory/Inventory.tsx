import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Package, Plus, Pencil, Trash, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

type InventoryItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  category: string;
  minStockLevel: number;
  lastRestocked: string;
};

type ConfirmModal = {
  show: boolean;
  itemId: string | null;
  action: 'delete' | 'update' | null;
};

const Inventory = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    show: false,
    itemId: null,
    action: null
  });
  const [updateQuantity, setUpdateQuantity] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const inventoryCollection = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryCollection);
      const inventoryList = inventorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      
      // Sort by category and then by item name
      inventoryList.sort((a, b) => {
        if (a.category === b.category) {
          return a.itemName.localeCompare(b.itemName);
        }
        return a.category.localeCompare(b.category);
      });
      
      setInventoryItems(inventoryList);
      
      // Initialize update quantities
      const quantities: { [key: string]: number } = {};
      inventoryList.forEach(item => {
        quantities[item.id] = 0; // Default to 0 for adding/removing
      });
      setUpdateQuantity(quantities);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to fetch inventory items');
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, operation: 'add' | 'remove') => {
    const item = inventoryItems.find(item => item.id === itemId);
    if (!item) return;
    
    const quantity = updateQuantity[itemId];
    if (!quantity) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    try {
      const newQuantity = operation === 'add' 
        ? item.quantity + quantity 
        : Math.max(0, item.quantity - quantity);
      
      const itemRef = doc(db, 'inventory', itemId);
      await updateDoc(itemRef, {
        quantity: newQuantity,
        lastRestocked: operation === 'add' ? new Date().toISOString() : item.lastRestocked
      });
      
      // Update local state
      setInventoryItems(inventoryItems.map(item => 
        item.id === itemId 
          ? { ...item, quantity: newQuantity, lastRestocked: operation === 'add' ? new Date().toISOString() : item.lastRestocked } 
          : item
      ));
      
      // Reset the update quantity for this item
      setUpdateQuantity({ ...updateQuantity, [itemId]: 0 });
      
      toast.success(`Successfully ${operation === 'add' ? 'added' : 'removed'} items from inventory`);
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error('Failed to update inventory');
    }
  };

  const handleDeleteItem = async () => {
    if (!confirmModal.itemId) return;
    
    try {
      await deleteDoc(doc(db, 'inventory', confirmModal.itemId));
      
      // Update local state
      setInventoryItems(inventoryItems.filter(item => item.id !== confirmModal.itemId));
      
      toast.success('Item deleted successfully');
      setConfirmModal({ show: false, itemId: null, action: null });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      toast.error('Failed to delete inventory item');
    }
  };

  // Get unique categories
  const categories = ['all', ...new Set(inventoryItems.map(item => item.category))].sort();

  // Filter inventory by search term and category
  const filteredInventory = inventoryItems.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
        <button
          onClick={() => navigate('/inventory/add')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-5 w-5 mr-1" />
          Add Item
        </button>
      </div>
      
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search inventory..."
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
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Restocked
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-md bg-blue-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                          {item.quantity <= item.minStockLevel && (
                            <div className="flex items-center text-xs text-red-600 mt-1">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Low stock
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">{item.quantity}</div>
                      <div className="text-xs text-gray-500">Min: {item.minStockLevel}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ₹{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.lastRestocked).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => navigate(`/inventory/edit/${item.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({
                            show: true,
                            itemId: item.id,
                            action: 'delete'
                          })}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          value={updateQuantity[item.id] || ''}
                          onChange={(e) => setUpdateQuantity({
                            ...updateQuantity,
                            [item.id]: parseInt(e.target.value) || 0
                          })}
                          className="w-16 h-8 text-xs rounded border-gray-300"
                        />
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 'add')}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 'remove')}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {filteredInventory.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterCategory !== 'all'
              ? "No items match your search criteria."
              : "You haven't added any inventory items yet."}
          </p>
          {!searchTerm && filterCategory === 'all' && (
            <button
              onClick={() => navigate('/inventory/add')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-1" />
              Add New Item
            </button>
          )}
        </div>
      )}
      
      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Delete Inventory Item</h2>
            <p className="mb-6">
              Are you sure you want to delete this inventory item? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmModal({ show: false, itemId: null, action: null })}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;