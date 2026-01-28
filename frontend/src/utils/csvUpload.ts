import { Product } from "@/types/price";
import { toast } from "sonner";

/**
 * Convert products to CSV format
 */
export function productsToCSV(products: Product[]): string {
    if (products.length === 0) {
        return "";
    }
    // Define CSV headers
    const headers = [
        "SKU",
        "Category",
        "Sub-category",
        "Brand",
        "Product Name",
        "MRP",
        "Discount",
        "Discount Amount",
        "Net Price",
        "Stock",
        "Rating",
    ];

    // Convert products to CSV rows
    const rows = products.map((product) => {
        const rawDiscount = Number(product.__rawRow["Discount"]) || 0;

        // Normalize discount
        const discountPercent = rawDiscount <= 1
            ? rawDiscount * 100
            : rawDiscount;

        return [
            product.id,
            product.category,
            product.__rawRow["Sub-category"] || "",
            product.brand || "",
            `"${product.name.replace(/"/g, '""')}"`,
            product.__rawRow["MRP"] || "",
            `${discountPercent}%`,              // ✅ ADD % HERE
            product.__rawRow["Discount Amount"] || "",
            product.sellingPrice || "",
            product.__rawRow["Stock"] || "",
            product.__rawRow["Rating"] || "",
        ];
    });


    // Combine headers and rows
    const csv = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
    ].join("\n");

    return csv;
}

/**
 * Get API URL from environment variable or use default
 */
function getApiUrl(): string {
    // Try to get from environment variable first
    const envUrl = import.meta.env.VITE_API_PRICING_UPLOAD_URL;
    if (envUrl) return envUrl;

    // Fall back to default localhost URL
    return "http://127.0.0.1:8000/api/pricing/upload/";
}

/**
 * Upload corrected pricing data to the API endpoint
 */
export async function uploadPricingToAPI(
    products: Product[],
    apiUrl?: string
): Promise<void> {
    if (products.length === 0) {
        toast.error("No products to upload");
        return;
    }

    // Use provided URL or get from config
    const finalApiUrl = apiUrl || getApiUrl();

    try {
        // Show loading toast
        const loadingToastId = toast.loading("Uploading pricing data...");

        // Convert products to CSV
        const csvData = productsToCSV(products);

        // Create FormData for file upload
        const formData = new FormData();
        const csvBlob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        formData.append("file", csvBlob, `pricing-data-${timestamp}.csv`);

        console.log("Uploading CSV data:", csvData);

        // Make PUT request to API
        const response = await fetch(finalApiUrl, {
            method: "PUT",
            body: formData,

        });
        console.log(formData)

        toast.dismiss(loadingToastId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `API error: ${response.status} - ${errorText || response.statusText}`
            );
        }

        const result = await response.json();

        toast.success("Upload successful!", {
            description: `Successfully uploaded ${products.length} products to the server`,
        });

        console.log("API Response:", result);
    } catch (error) {
        toast.dismiss();
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
        toast.error("Upload failed", {
            description: errorMessage,
        });
        console.error("Upload error:", error);
        throw error;
    }
}
