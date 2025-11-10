import React, { useState, useEffect } from 'react';
import PaymentCalendar from './PaymentCalendar';
import PaymentList from './PaymentList';
import PaymentSummary from './PaymentSummary';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { CalendarDays, ListFilter, Download } from 'lucide-react';

const PaymentsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(1)), // First day of current month
    end: new Date(new Date().setHours(23, 59, 59, 999)), // Today
  });

  useEffect(() => {
    fetchAllPayments();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      filterPaymentsByDate(selectedDate);
    }
  }, [selectedDate, payments, filterType, searchQuery]);

  const fetchAllPayments = async () => {
    setIsLoading(true);
    try {
      const paymentRecords: any[] = [];
      
      // Fetch check-in payments from all check-ins
      const checkinsSnapshot = await getDocs(collection(db, 'checkins'));
      
      for (const checkinDoc of checkinsSnapshot.docs) {
        const checkinData = checkinDoc.data();
        
        // Add additional payments if they exist
        const paymentsSnapshot = await getDocs(collection(db, 'checkins', checkinDoc.id, 'payments'));
        const additionalPayments = paymentsSnapshot.docs.map((payDoc) => {
          const payData = payDoc.data();
          return {
            id: payDoc.id,
            amount: payData.amount,
            timestamp: payData.timestamp?.toDate() || new Date(),
            type: payData.type || 'additional',
            paymentStatus: 'completed',
            customerName: checkinData.guestName || 'Guest',
            roomNumber: checkinData.roomNumber || 'N/A',
            description: `${payData.type === 'extension' ? 'Stay extension' : 'Additional payment'}`,
            paymentMode: payData.mode,
            mode: payData.mode // Ensure both properties exist for consistent filtering
          };
        });
        
        paymentRecords.push(...additionalPayments);
      }
      
      // Sort payments by timestamp (newest first)
      paymentRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setPayments(paymentRecords);
      if (selectedDate) {
        filterPaymentsByDate(selectedDate);
      } else {
        setFilteredPayments(paymentRecords);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterPaymentsByDate = (date: Date) => {
    // Create a date range for the selected date (full day)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let filtered = payments.filter(payment => {
      const paymentDate = payment.timestamp instanceof Date ? 
        payment.timestamp : 
        new Date(payment.timestamp);
        
      return paymentDate >= startOfDay && paymentDate <= endOfDay;
    });
    
    // Apply type filter if not 'all'
    if (filterType !== 'all') {
      filtered = filtered.filter(payment => payment.type === filterType);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.customerName?.toLowerCase().includes(query) ||
        payment.description?.toLowerCase().includes(query) ||
        payment.roomNumber?.toString().includes(query) ||
        payment.amount?.toString().includes(query)
      );
    }
    
    setFilteredPayments(filtered);
  };

  const getPaymentsByMonth = () => {
    const monthData: { [key: string]: { count: number, total: number } } = {};
    
    payments.forEach(payment => {
      if (payment.mode !== 'cash' && payment.mode !== 'gpay' && 
          payment.paymentMode !== 'cash' && payment.paymentMode !== 'gpay') {
        return; // Skip non-cash/gpay payments
      }
      
      const date = payment.timestamp instanceof Date ? 
        payment.timestamp : 
        new Date(payment.timestamp);
      
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthData[monthKey]) {
        monthData[monthKey] = { count: 0, total: 0 };
      }
      
      monthData[monthKey].count += 1;
      monthData[monthKey].total += parseFloat(payment.amount) || 0;
    });
    
    return monthData;
  };

  const handleExportData = () => {
    // Only include cash and gpay payments in export
    const dataToExport = filteredPayments
      .filter(payment => payment.mode === 'cash' || payment.mode === 'gpay' || 
                         payment.paymentMode === 'cash' || payment.paymentMode === 'gpay')
      .map(payment => ({
        Date: payment.timestamp instanceof Date ? 
          payment.timestamp.toLocaleDateString() : 
          new Date(payment.timestamp).toLocaleDateString(),
        Time: payment.timestamp instanceof Date ? 
          payment.timestamp.toLocaleTimeString() : 
          new Date(payment.timestamp).toLocaleTimeString(),
        Customer: payment.customerName,
        Room: payment.roomNumber,
        Amount: payment.amount,
        Type: payment.type,
        Mode: payment.mode || payment.paymentMode || 'N/A',
        Description: payment.description
      }));
    
    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      "Date,Time,Customer,Room,Amount,Type,Mode,Description\n" + 
      dataToExport.map(row => 
        Object.values(row).map(val => `"${val}"`).join(",")
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payments_${selectedDate?.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTotalAmount = () => {
    return filteredPayments
      .filter(payment => payment.mode === 'cash' || payment.mode === 'gpay' || 
                         payment.paymentMode === 'cash' || payment.paymentMode === 'gpay')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  const getCashTotal = () => {
    return filteredPayments
      .filter(payment => payment.mode === 'cash' || payment.paymentMode === 'cash')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  const getGpayTotal = () => {
    return filteredPayments
      .filter(payment => payment.mode === 'gpay' || payment.paymentMode === 'gpay')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Logs</h1>
        <p className="text-gray-600">Track and manage all payment transactions</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center px-3 py-2 rounded-md ${
                  view === 'calendar' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition-colors duration-200`}
              >
                <CalendarDays className="h-5 w-5 mr-2" />
                Calendar View
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center px-3 py-2 rounded-md ${
                  view === 'list' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition-colors duration-200`}
              >
                <ListFilter className="h-5 w-5 mr-2" />
                List View
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Types</option>
                  <option value="advance">Payments</option>
                  <option value="extension">Extension</option>
                </select>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <button
                onClick={handleExportData}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
          {view === 'calendar' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PaymentCalendar 
                  payments={payments}
                  selectedDate={selectedDate}
                  onSelectDate={(date) => setSelectedDate(date)}
                />
              </div>
              <div className="lg:col-span-1">
                <PaymentSummary 
                  payments={payments}
                  filteredPayments={filteredPayments}
                  selectedDate={selectedDate}
                  totalAmount={getTotalAmount()}
                />
              </div>
            </div>
          ) : (
            <PaymentList 
              payments={filteredPayments.filter(payment => 
                payment.mode === 'cash' || payment.mode === 'gpay' || 
                payment.paymentMode === 'cash' || payment.paymentMode === 'gpay'
              )}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
      
      {selectedDate && filteredPayments.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">
              Payment Logs for {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
            <div className="flex mt-2 gap-3">
              <div className="bg-green-50 px-3 py-1 rounded-lg">
                <span className="text-sm text-green-700">Cash: ₹{getCashTotal().toFixed(2)}</span>
              </div>
              <div className="bg-blue-50 px-3 py-1 rounded-lg">
                <span className="text-sm text-blue-700">GPay: ₹{getGpayTotal().toFixed(2)}</span>
              </div>
              <div className="bg-purple-50 px-3 py-1 rounded-lg">
                <span className="text-sm text-purple-700">Total: ₹{(getCashTotal() + getGpayTotal()).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mode
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments
                  .filter(payment => payment.mode === 'cash' || payment.mode === 'gpay' || 
                                     payment.paymentMode === 'cash' || payment.paymentMode === 'gpay')
                  .map((payment) => {
                    const timestamp = payment.timestamp instanceof Date ? 
                      payment.timestamp : 
                      new Date(payment.timestamp);
                    
                    const paymentMode = payment.mode || payment.paymentMode || 'n/a';
                      
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {timestamp.toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.customerName || 'Guest'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.roomNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ₹{parseFloat(payment.amount).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.type === 'advance' ? 'bg-green-100 text-green-800' :
                            payment.type === 'extension' ? 'bg-amber-100 text-amber-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {payment.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            paymentMode === 'cash' ? 'bg-green-100 text-green-800' :
                            paymentMode === 'gpay' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {paymentMode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.description || 'Payment'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;