type IdentityFields = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderReference: string;
  itemName: string;
  itemSku: string;
};

export function normalizeIdentity<T extends IdentityFields>(input: T): T {
  return {
    ...input,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim().toLowerCase(),
    customerPhone: input.customerPhone.trim(),
    orderReference: input.orderReference.trim().toUpperCase(),
    itemName: input.itemName.trim(),
    itemSku: input.itemSku.trim().toUpperCase(),
  };
}
