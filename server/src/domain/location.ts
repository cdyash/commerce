import { PincodeEntry } from '../store/seedLoader.js';
import { AppError } from '../middleware/errorHandler.js';
import { SessionLocation } from '../store/memoryStore.js';

export function lookupPincode(
  pincode: string,
  pincodesMap: Map<string, PincodeEntry>,
  label?: string
): SessionLocation {
  const cleanPincode = pincode.trim();
  const found = pincodesMap.get(cleanPincode);

  if (!found) {
    throw new AppError(
      422,
      'LOCATION_UNSERVICEABLE',
      `Delivery is not currently available to pincode '${cleanPincode}'. QuickCart currently services selected pincodes in Jaipur (302001, 302017, 302021), New Delhi, Bengaluru, and Mumbai.`,
      { pincode: cleanPincode }
    );
  }

  return {
    ...found,
    label: label?.trim() || undefined,
    serviceable: true,
  };
}

