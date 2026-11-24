import type { DeliveryTripStatus, Language, OrderStatus } from '../types';

export type CustomerProgressStage =
  | 'preparing'
  | 'driver_assigned'
  | 'driver_accepted'
  | 'out_for_delivery'
  | 'driver_arrived'
  | 'delivered';

export interface TripStageMeta {
  stage: CustomerProgressStage;
  stepIndex: number;
  labelAr: string;
  labelEn: string;
}

export const CUSTOMER_PROGRESS_STEPS: TripStageMeta[] = [
  {
    stage: 'preparing',
    stepIndex: 0,
    labelAr: 'الطلب قيد التجهيز',
    labelEn: 'Preparing Order',
  },
  {
    stage: 'driver_assigned',
    stepIndex: 1,
    labelAr: 'تم تعيين مندوب',
    labelEn: 'Driver Assigned',
  },
  {
    stage: 'driver_accepted',
    stepIndex: 2,
    labelAr: 'المندوب قبل الرحلة',
    labelEn: 'Driver Accepted Trip',
  },
  {
    stage: 'out_for_delivery',
    stepIndex: 3,
    labelAr: 'المندوب في طريقه إليك',
    labelEn: 'Driver On The Way',
  },
  {
    stage: 'driver_arrived',
    stepIndex: 4,
    labelAr: 'المندوب وصل إليك',
    labelEn: 'Driver Arrived',
  },
  {
    stage: 'delivered',
    stepIndex: 5,
    labelAr: 'تم تسليم الطلب',
    labelEn: 'Order Delivered',
  },
];

export function resolveCustomerProgressStage(
  orderStatus: OrderStatus | string,
  tripStatus?: DeliveryTripStatus | string,
  hasAssignedDriver?: boolean
): TripStageMeta {
  if (orderStatus === 'delivered' || tripStatus === 'completed') {
    return CUSTOMER_PROGRESS_STEPS[5];
  }
  if (orderStatus === 'out_for_delivery' && tripStatus === 'arrived') {
    return CUSTOMER_PROGRESS_STEPS[4];
  }
  if (orderStatus === 'out_for_delivery') {
    return CUSTOMER_PROGRESS_STEPS[3];
  }
  if (tripStatus === 'accepted') {
    return CUSTOMER_PROGRESS_STEPS[2];
  }
  if (tripStatus === 'assigned' || (hasAssignedDriver && tripStatus !== 'cancelled')) {
    return CUSTOMER_PROGRESS_STEPS[1];
  }
  return CUSTOMER_PROGRESS_STEPS[0];
}

export function getMerchantTripStatusMeta(
  tripStatus: DeliveryTripStatus | string | undefined,
  language: Language
): { label: string; cls: string } {
  switch (tripStatus) {
    case 'assigned':
      return {
        label: language === 'ar' ? 'تم تعيين مندوب (بانتظار القبول)' : 'Driver Assigned (Awaiting Acceptance)',
        cls: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    case 'accepted':
      return {
        label: language === 'ar' ? 'المندوب قبل الرحلة' : 'Driver Accepted Trip',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'in_transit':
      return {
        label: language === 'ar' ? 'المندوب في الطريق للعميل' : 'In Transit to Customer',
        cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'arrived':
      return {
        label: language === 'ar' ? 'المندوب وصل للعميل' : 'Driver Arrived at Customer',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'completed':
      return {
        label: language === 'ar' ? 'تم تسليم الطلب' : 'Trip Completed',
        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'cancelled':
      return {
        label: language === 'ar' ? 'ألغى المندوب الرحلة — يحتاج إعادة تعيين' : 'Driver Cancelled — Needs Reassignment',
        cls: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    default:
      return {
        label: language === 'ar' ? 'لم يُسند لمندوب بعد' : 'Unassigned',
        cls: 'bg-[#FAF9F7] text-[#6E6A66] border-[#EAE6E1]',
      };
  }
}
