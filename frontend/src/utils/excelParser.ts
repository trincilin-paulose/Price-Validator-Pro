import * as XLSX from "xlsx";
import { Product, PriceThreshold } from "@/types/price";
import { determineProductStatus, DEFAULT_THRESHOLDS } from "./priceValidation";

interface RawProductData {
  [key: string]: string | number | undefined;
}

export function parseExcelFile(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData: RawProductData[] = XLSX.utils.sheet_to_json(worksheet);

        // ✅ Store raw excel data in localStorage
        localStorage.setItem("excelRawData", JSON.stringify(jsonData));

        console.log("Raw JSON data from Excel:", jsonData);

        const products = mapToProducts(jsonData, DEFAULT_THRESHOLDS);
        resolve(products);
      } catch (error) {
        reject(
          new Error(
            "Failed to parse Excel file. Please ensure the file format is correct.",
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parsePrice(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  // Remove currency symbols, commas, and spaces (handles formats like "1,70,000" or "₹90,000")
  const cleaned = String(value).replace(/[₹$€£,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

// Extract first URL found in any field of the row (client's reference website)
function extractFirstUrl(row: RawProductData): string | undefined {
  const urlPattern =
    /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/gi;

  // First check dedicated URL fields
  for (const key in row) {
    if (
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("website") ||
      key.toLowerCase().includes("link") ||
      key.toLowerCase().includes("competitor")
    ) {
      const value = String(row[key] || "");
      if (value) {
        const matches = value.match(urlPattern);
        if (matches && matches.length > 0) {
          let url = matches[0];
          if (!url.startsWith("http")) {
            url = "https://" + url;
          }
          return url;
        }
      }
    }
  }

  // If no dedicated URL field, search all values for URLs
  for (const key in row) {
    const value = String(row[key] || "");
    if (value && value.length > 0) {
      const matches = value.match(urlPattern);
      if (matches && matches.length > 0) {
        let url = matches[0];
        if (!url.startsWith("http")) {
          url = "https://" + url;
        }
        return url;
      }
    }
  }

  return undefined;
}

function mapToProducts(
  data: RawProductData[],
  thresholds: PriceThreshold,
): Product[] {
  return data.map((row, index) => {
    const id = String(
      row["Product ID"] ||
        row["ID"] ||
        row["id"] ||
        row["SKU"] ||
        `PROD-${index + 1}`,
    );
    const name = String(
      row["Product Name"] ||
        row["ProductName"] ||
        row["Name"] ||
        row["name"] ||
        row["Title"] ||
        `Product ${index + 1}`,
    );
    const sku = String(row["SKU"] || row["sku"] || row["Product Code"] || id);
    const category = String(
      row["Category"] ||
        row["Sub-category"] ||
        row["category"] ||
        "Uncategorized",
    );
    const brand = row["Brand"] || row["brand"] || row["Manufacturer"];

    // Extract competitor URL (client's reference website)
    const competitorUrl = extractFirstUrl(row);

    // Parse prices - handle ItemPrice (₹) format with commas
    const itemPrice = parsePrice(
      row["Net Price (₹)"] || row["Net Price"] || row["Item Price"],
    );
    const originalPrice =
      parsePrice(
        row["Original Price"] ||
          row["MRP"] ||
          row["List Price"] ||
          row["originalPrice"],
      ) ||
      itemPrice ||
      100;
    const sellingPrice =
      parsePrice(
        row["Selling Price"] ||
          row["Price"] ||
          row["Sale Price"] ||
          row["sellingPrice"],
      ) ||
      itemPrice ||
      originalPrice;
    const costPrice =
      parsePrice(row["Cost Price"] || row["Cost"] || row["costPrice"]) ||
      sellingPrice * 0.6;

    const discountPercent =
      originalPrice > 0
        ? ((originalPrice - sellingPrice) / originalPrice) * 100
        : 0;

    const profitMargin =
      sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;

    const product = {
      id,
      name,
      sku,
      category,
      brand: brand ? String(brand) : undefined,
      originalPrice: isNaN(originalPrice) ? 0 : originalPrice,
      sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
      discountPercent: isNaN(discountPercent) ? 0 : discountPercent,
      costPrice: isNaN(costPrice) ? 0 : costPrice,
      profitMargin: isNaN(profitMargin) ? 0 : profitMargin,
      competitorUrl: competitorUrl,
      status: "valid",
    } as Product & { __rawRow?: RawProductData; __netPriceField?: string };

    // Keep the original raw row so exports can preserve arbitrary columns
    product.__rawRow = row;

    // Detect which column in the original row corresponds to the net/selling price
    const preferredKeys = [
      "Net Price (₹)",
      "Net Price",
      "NetPrice",
      "Item Price",
      "Selling Price",
      "sellingPrice",
      "SellingPrice",
      "Sale Price",
      "Price",
      "price",
      "List Price",
      "MRP",
    ];

    let detectedKey: string | undefined;
    for (const k of preferredKeys) {
      if (Object.keys(row).includes(k)) {
        detectedKey = k;
        break;
      }
    }

    if (!detectedKey) {
      // fallback regex matching for less common headers
      const keys = Object.keys(row);
      const regex =
        /net\s*price|selling\s*price|item\s*price|sale\s*price|^price$|list\s*price|mrp/i;
      for (const k of keys) {
        if (regex.test(k) && !/cost|original/i.test(k)) {
          detectedKey = k;
          break;
        }
      }
    }

    if (detectedKey) product.__netPriceField = detectedKey;

    product.status = determineProductStatus(product as Product, thresholds);

    return product as Product;
  });
}

export function exportToExcel(products: Product[]) {
  const rawDataString = localStorage.getItem("excelRawData");

  if (!rawDataString) {
    console.error("No raw Excel data found in localStorage");
    return;
  }

  const rawData: RawProductData[] = JSON.parse(rawDataString);

  const hasOwn = (obj: unknown, key: string) => {
    if (typeof obj !== "object" || obj === null) return false;
    return Object.prototype.hasOwnProperty.call(obj, key);
  };

  const updatedData = rawData.map((row, index) => {
    const product = products[index];
    if (!product) return row;

    const preferredKeys = [
      "Net Price (₹)",
      "Net Price",
      "NetPrice",
      "Item Price",
      "Selling Price",
      "Sale Price",
      "Price",
    ];

    let netKey: string | undefined;

    for (const key of preferredKeys) {
      if (hasOwn(row, key)) {
        netKey = key;
        break;
      }
    }

    // Regex fallback
    if (!netKey) {
      for (const key of Object.keys(row)) {
        if (
          /net\s*price|selling\s*price|item\s*price|sale\s*price|^price$/i.test(
            key,
          )
        ) {
          netKey = key;
          break;
        }
      }
    }

    if (netKey) {
      row[netKey] = product.sellingPrice;
    } else {
      // If no price column exists, add one
      row["Net Price"] = product.sellingPrice;
    }

    return row;
  });

  // Preserve original headers/order
  const headers = Object.keys(updatedData[0] || {});

  const worksheet = XLSX.utils.json_to_sheet(updatedData, {
    header: headers,
    skipHeader: false,
  });

  // Convert worksheet → CSV
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Trigger CSV download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "products details.csv";
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
