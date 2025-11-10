import { db } from '../../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  increment, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';

type CartItem = {
  inventoryId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

export const ShopPurchaseService = {
  processPurchase: async (checkinId: string, cartItems: CartItem[]) => {
    try {
      if (!checkinId || cartItems.length === 0) {
        throw new Error('Invalid purchase data');
      }
      
      const totalAmount = cartItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice, 
        0
      );

      const batch = writeBatch(db);

      // Update inventory quantities
      for (const item of cartItems) {
        const inventoryRef = doc(db, 'inventory', item.inventoryId);
        batch.update(inventoryRef, {
          quantity: increment(-item.quantity)
        });
      }

      // Create purchase records
      const purchasesCollection = collection(db, 'purchases');
      cartItems.forEach(item => {
        const purchaseRef = doc(purchasesCollection);
        batch.set(purchaseRef, {
          checkinId,
          inventoryId: item.inventoryId,
          itemName: item.itemName,
          quantity: item.quantity,
          amount: item.quantity * item.unitPrice,
          paymentStatus: 'pending',
          createdAt: Timestamp.now()
        });
      });

      // Update the checkin's pending amount
      const checkinRef = doc(db, 'checkins', checkinId);
      batch.update(checkinRef, {
        initialPayment: increment(-totalAmount)
      });

      // Add a payment entry for the shop purchase
      const paymentRef = doc(collection(db, 'checkins', checkinId, 'payments'));
      batch.set(paymentRef, {
        amount: -totalAmount,
        mode: 'shop',
        type: 'shop-purchase',
        timestamp: Timestamp.now(),
        description: `Shop purchase (${cartItems.length} items)`
      });

      // Commit all changes
      await batch.commit();

      return { success: true, message: 'Purchase processed successfully' };
    } catch (error) {
      console.error('Error processing purchase:', error);
      throw error;
    }
  },
  
  getPurchasesByCheckin: async (checkinId: string) => {
    try {
      const purchasesQuery = query(
        collection(db, 'purchases'), 
        where('checkinId', '==', checkinId)
      );
      
      const purchasesSnapshot = await getDocs(purchasesQuery);
      return purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  }
};
