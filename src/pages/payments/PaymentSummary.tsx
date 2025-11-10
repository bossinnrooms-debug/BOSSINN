import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface PaymentSummaryProps {
  payments: any[];
  filteredPayments: any[];
  selectedDate: Date | null;
  totalAmount: number;
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({ 
  payments, 
  filteredPayments,
  selectedDate,
  totalAmount 
}) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [totalCash, setTotalCash] = useState(0);
  const [totalGpay, setTotalGpay] = useState(0);
  
  useEffect(() => {
    if (selectedDate) {
      // Calculate cash and GPay totals
      const cashTotal = filteredPayments.reduce((acc, payment) => {
        if (payment.mode === 'cash' || (payment.paymentMode === 'cash' && payment.amount > 0)) {
          return acc + parseFloat(payment.amount || 0);
        }
        return acc;
      }, 0);

      const gpayTotal = filteredPayments.reduce((acc, payment) => {
        if (payment.mode === 'gpay' || (payment.paymentMode === 'gpay' && payment.amount > 0)) {
          return acc + parseFloat(payment.amount || 0);
        }
        return acc;
      }, 0);

      setTotalCash(cashTotal);
      setTotalGpay(gpayTotal);

      // Create chart data for payment modes
      const modeChartData = [
        { name: 'Cash', value: cashTotal },
        { name: 'GPay', value: gpayTotal }
      ].filter(item => item.value > 0);

      setChartData(modeChartData);
      
      // Calculate weekly trend
      const endDate = new Date(selectedDate);
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 6);
      
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const dayPayments = payments.filter(payment => {
          const paymentDate = payment.timestamp instanceof Date ? 
            payment.timestamp : 
            new Date(payment.timestamp);
            
          return (
            paymentDate.getDate() === date.getDate() &&
            paymentDate.getMonth() === date.getMonth() &&
            paymentDate.getFullYear() === date.getFullYear() &&
            ((payment.mode === 'cash' || payment.mode === 'gpay') ||
             (payment.paymentMode === 'cash' || payment.paymentMode === 'gpay'))
          );
        });

        const dayCash = dayPayments.reduce((acc, payment) => 
          (payment.mode === 'cash' || payment.paymentMode === 'cash') ? acc + parseFloat(payment.amount || 0) : acc, 0
        );

        const dayGpay = dayPayments.reduce((acc, payment) => 
          (payment.mode === 'gpay' || payment.paymentMode === 'gpay') ? acc + parseFloat(payment.amount || 0) : acc, 0
        );
        
        weekData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          cash: parseFloat(dayCash.toFixed(2)),
          gpay: parseFloat(dayGpay.toFixed(2))
        });
      }
      
      setWeeklyData(weekData);
    }
  }, [selectedDate, filteredPayments, payments]);

  const COLORS = ['#10B981', '#3B82F6'];
  
  if (!selectedDate) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Select a date to view payment summary</p>
      </div>
    );
  }
  
  if (filteredPayments.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No payment data for the selected date</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">
        Summary for {selectedDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })}
      </h3>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-700 mb-1">Cash Collected</p>
          <p className="text-2xl font-bold text-green-800">₹{totalCash.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-700 mb-1">GPay Collected</p>
          <p className="text-2xl font-bold text-blue-800">₹{totalGpay.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-700 mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-purple-800">₹{(totalCash + totalGpay).toFixed(2)}</p>
        </div>
      </div>
      
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-600 mb-3">Payment Mode Distribution</h4>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  formatter={(value) => [`₹${value}`, 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">No distribution data available</p>
            </div>
          )}
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-3">Weekly Collection Trend</h4>
        <div className="h-64">
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`₹${value}`, 'Amount']}
                />
                <Legend />
                <Bar dataKey="cash" name="Cash" fill="#10B981" />
                <Bar dataKey="gpay" name="GPay" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">No trend data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSummary;