let cachedData: any[] = [];
let lastScraped: Date | null = null;

export function getCachedData() { 
  return { data: cachedData, lastScraped }; 
}

export function getStoreData(storeNumber: string) {
  return cachedData.find(store => store.store_number === storeNumber) || null;
}

export function setCachedData(data: any[]) { 
  cachedData = data; 
  lastScraped = new Date(); 
}

