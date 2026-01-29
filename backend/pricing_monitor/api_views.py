from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.renderers import JSONRenderer

from pricing_monitor.models import ProductCSVUpload


@method_decorator(csrf_exempt, name="dispatch")
class ProductCSVUploadAPIView(APIView):
    """
    Handles CSV/XLSX upload from React frontend
    """
    parser_classes = (MultiPartParser, FormParser)
    renderer_classes = (JSONRenderer,)

    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")

        # 1️⃣ Validate file presence
        if not file:
            return Response(
                {"error": "No file provided. Please upload a CSV or XLSX file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2️⃣ Validate file type
        allowed_extensions = (".csv", ".xlsx", ".xls")
        if not file.name.lower().endswith(allowed_extensions):
            return Response(
                {"error": "Invalid file type. Only CSV or Excel files are allowed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3️⃣ Save upload record
        upload = ProductCSVUpload.objects.create(
            file=file,
            status="uploaded"
        )

        # 4️⃣ Success response (React-friendly)
        return Response(
            {
                "message": "File uploaded successfully",
                "upload_id": upload.id,
                "file_name": file.name,
                "status": upload.status
            },
            status=status.HTTP_201_CREATED
        )
