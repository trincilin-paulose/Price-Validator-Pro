import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileUpload } from "./FileUpload";
import { FileSpreadsheet, ArrowRight, Loader2, Server } from "lucide-react";

interface ClientUploadFormProps {
  onSubmit?: (file: File) => void; // optional now
  isLoading?: boolean;
}

export function ClientUploadForm({
  onSubmit,
  isLoading,
}: ClientUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pythonLoading, setPythonLoading] = useState(false);

  const handleFileSelect = (file: File) => {
    console.log("File selected:", file);
    setSelectedFile(file);
  };

  // Existing React-side submit
  const handleSubmit = () => {
    if (selectedFile && onSubmit) {
      onSubmit(selectedFile);
    }
  };

  // 🔴 NEW: Python upload submit
  const handlePythonSubmit = async () => {
    if (!selectedFile) return;

    setPythonLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:8000/api/upload-excel", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Python response:", data);

      alert(data.message || "Processed in Python");
    } catch (error) {
      console.error(error);
      alert("Python processing failed");
    } finally {
      setPythonLoading(false);
    }
  };

  const canSubmit = selectedFile && !isLoading;
  const canPythonSubmit = selectedFile && !pythonLoading;

  return (
    <Card className="max-w-2xl mx-auto shadow-card animate-slide-up">
      <CardHeader className="text-center">
        <div className="p-4 mx-auto w-fit rounded-full bg-primary/10 mb-4">
          <FileSpreadsheet className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">Upload Product Data</CardTitle>
        <CardDescription className="text-base">
          Upload the product Excel file. Our AI will analyze and validate
          pricing automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Product Excel File
          </Label>

          <FileUpload
            onFileSelect={handleFileSelect}
            isLoading={isLoading || pythonLoading}
          />

          {selectedFile && (
            <p className="text-sm text-success flex items-center gap-2">
              ✓ {selectedFile.name} selected
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-12 gradient-primary text-primary-foreground"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Competitor Price Analysis...
              </>
            ) : (
              <>
                Competitor Price Analysis
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            className="h-12"
            onClick={handlePythonSubmit}
            disabled={!canPythonSubmit}
          >
            {pythonLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Price Validator...
              </>
            ) : (
              <>
                Price Validator
                <Server className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t">
          {[
            { step: "1", title: "Upload", desc: "Excel file" },
            { step: "2", title: "Process", desc: "React / Python" },
            { step: "3", title: "Review", desc: "Results" },
          ].map((item) => (
            <div
              key={item.step}
              className="text-center p-3 rounded-lg bg-muted/50"
            >
              <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {item.step}
              </div>
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
