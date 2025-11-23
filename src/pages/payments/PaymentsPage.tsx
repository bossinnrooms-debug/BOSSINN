import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';

type Payment = {
  id: string;
  amount: number;
  timestamp: any;
  customerName: string;
  roomNumber: string;
  type: string;
  paymentStatus: string;
  description: string;
  paymentMode?: string;
  mode?: string;
  date_of_booking?: string;
};

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchAllPayments();
  }, []);

  useEffect(() => {
    filterAndSortPayments();
  }, [payments, searchQuery, sortBy, sortDirection, filterType]);

  const fetchAllPayments = async () => {
    setIsLoading(true);
    try {
      const paymentRecords: Payment[] = [];

      const checkinsSnapshot = await getDocs(collection(db, 'checkins'));

      for (const checkinDoc of checkinsSnapshot.docs) {
        const checkinData = checkinDoc.data();

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
            description: `${payData.type === 'extension' ? 'Stay extension' :  payData.type === 'initial' ? 'Initial payment' : 'Additional payment'}`,
            paymentMode: payData.mode,
            mode: payData.mode
          };
        }).filter(payment => payment.type !== 'extension');

        paymentRecords.push(...additionalPayments);
      }

      const directPaymentsSnapshot = await getDocs(collection(db, 'payments'));
      const directPayments = directPaymentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount || 0,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type || 'payment',
          paymentStatus: data.paymentStatus || 'completed',
          customerName: data.customerName || data.customer_name || 'Guest',
          roomNumber: data.roomNumber || 'N/A',
          description: data.description || data.note || 'Payment',
          paymentMode: data.paymentMode || data.mode,
          mode: data.mode || data.paymentMode
        };
      });

      paymentRecords.push(...directPayments);

      setPayments(paymentRecords);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortPayments = () => {
    let filtered = [...payments];

    if (filterType !== 'all') {
      filtered = filtered.filter(payment => payment.type === filterType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customerName?.toLowerCase().includes(query) ||
        payment.description?.toLowerCase().includes(query) ||
        payment.roomNumber?.toString().includes(query) ||
        payment.amount?.toString().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case 'timestamp':
          valueA = new Date(a.timestamp).getTime();
          valueB = new Date(b.timestamp).getTime();
          break;
        case 'amount':
          valueA = parseFloat(a.amount.toString()) || 0;
          valueB = parseFloat(b.amount.toString()) || 0;
          break;
        case 'customerName':
          valueA = a.customerName || '';
          valueB = b.customerName || '';
          break;
        case 'roomNumber':
          valueA = a.roomNumber || '';
          valueB = b.roomNumber || '';
          break;
        default:
          valueA = a[sortBy] || '';
          valueB = b[sortBy] || '';
      }

      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    setFilteredPayments(filtered);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortDirection === 'asc' ?
      <ArrowUp className="h-3 w-3 ml-1 inline" /> :
      <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const getCashTotal = () => {
    return filteredPayments
      .filter(payment => payment.mode === 'cash' || payment.paymentMode === 'cash')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount.toString()) || 0), 0);
  };

  const getGpayTotal = () => {
    return filteredPayments
      .filter(payment => payment.mode === 'gpay' || payment.paymentMode === 'gpay')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount.toString()) || 0), 0);
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
            <div className="flex items-center space-x-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Types</option>
                  <option value="advance">Advance</option>
                  <option value="initial">Initial</option>
                  <option value="extension">Extension</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-green-50 px-3 py-1 rounded-lg">
                <span className="text-sm text-green-700">Cash: ₹{getCashTotal().toFixed(2)}</span>
              </div>
              <div className="bg-blue-50 px-3 py-1 rounded-lg">
                <span className="text-sm text-blue-700">GPay: ₹{getGpayTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No payment records found</h3>
              <p className="mt-1 text-sm text-gray-500">There are no payment records available for the selected criteria.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center">
                      Date & Time
                      {renderSortIcon('timestamp')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center">
                      Customer
                      {renderSortIcon('customerName')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('roomNumber')}
                  >
                    <div className="flex items-center">
                      Room
                      {renderSortIcon('roomNumber')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center">
                      Amount
                      {renderSortIcon('amount')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center">
                      Type
                      {renderSortIcon('type')}
                    </div>
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
                {filteredPayments.map((payment) => {
                  const timestamp = payment.timestamp instanceof Date ?
                    payment.timestamp :
                    new Date(payment.timestamp);

                  const paymentMode = payment.mode || payment.paymentMode || 'n/a';

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {timestamp.toLocaleDateString('en-IN')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {timestamp.toLocaleTimeString('en-IN')}
                        </div>
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
                        <div className={`text-sm font-medium ${payment.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          ₹{parseFloat(payment.amount.toString()).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          payment.type === 'advance' ? 'bg-green-100 text-green-800' :
                          payment.type === 'initial' ? 'bg-blue-100 text-blue-800' :
                          payment.type === 'extension' ? 'bg-amber-100 text-amber-800' :
                          payment.type === 'refund' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {payment.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
