import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

type InventoryFormData = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  category: string;
  minStockLevel: number;
  description: string;
};

const AddInventory = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<InventoryFormData>();
  const navigate = useNavigate();

  const onSubmit = async (data: InventoryFormData) => {
    try {
      // Parse numeric values
      const parsedData = {
        ...data,
        quantity: Number(data.quantity),
        unitPrice: Number(data.unitPrice),
        minStockLevel: Number(data.minStockLevel),
        lastRestocked: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'inventory'), parsedData);
      toast.success('Inventory item added successfully');
      navigate('/inventory');
    } catch (error) {
      console.error('Error adding inventory item:', error);
      toast.error('Failed to add inventory item');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Add Inventory Item</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name
          </label>
          <input
            type="text"
            {...register('itemName', { required: 'Item name is required' })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.itemName && (
            <p className="mt-1 text-sm text-red-600">{errors.itemName.message}</p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              {...register('category', { required: 'Category is required' })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a category</option>
              <option value="Toiletries">Toiletries</option>
              <option value="Bedding">Bedding</option>
              <option value="Food & Beverages">Food & Beverages</option>
              <option value="Cleaning Supplies">Cleaning Supplies</option>
              <option value="Electronics">Electronics</option>
              <option value="Furniture">Furniture</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              {...register('quantity', { 
                required: 'Quantity is required',
                min: {
                  value: 0,
                  message: 'Quantity cannot be negative'
                }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('unitPrice', { 
                required: 'Unit price is required',
                min: {
                  value: 0,
                  message: 'Price cannot be negative'
                }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.unitPrice && (
              <p className="mt-1 text-sm text-red-600">{errors.unitPrice.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Stock Level
            </label>
            <input
              type="number"
              {...register('minStockLevel', { 
                required: 'Minimum stock level is required',
                min: {
                  value: 0,
                  message: 'Minimum stock level cannot be negative'
                }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.minStockLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.minStockLevel.message}</p>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            {...register('description')}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
          >
            Add Item
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddInventory;