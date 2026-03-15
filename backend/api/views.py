from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from api.models import *
from rest_framework.views import APIView
from api.serializer import *
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Q


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer
    permission_classes = [AllowAny]

class RegisterUserViewSet(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({"message": "Logged out successfully"})

        except Exception:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

class ProfileView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        return Response({
            "username": user.username,
            "email": user.email,
        })

# Create your views here.
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def clients(self, request, pk=None):

        try:
            user = User.objects.get(id=pk)
            clients = Client.objects.filter(lawyer=user)
            return Response(ClientSerializer(clients, many=True, context={'request': request}).data)
        
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return Client.objects.filter(lawyer=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(lawyer=self.request.user)
    
class CaseViewSet(viewsets.ModelViewSet):
    serializer_class = CaseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'case_type', 'priority_level', 'court_level']
    search_fields = ['case_title', 'case_number', 'cnr_number', 'description']
    ordering_fields = ['created_at', 'filing_date', 'priority_level', 'status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return Case.objects.filter(client__lawyer=self.request.user).select_related('client')

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Returns summary stats for the logged-in user's cases."""
        cases = Case.objects.filter(client__lawyer=request.user)

        status_counts = cases.values('status').annotate(count=Count('id'))
        type_counts = cases.values('case_type').annotate(count=Count('id'))
        priority_counts = cases.values('priority_level').annotate(count=Count('id'))

        return Response({
            "total_cases": cases.count(),
            "by_status": {item['status']: item['count'] for item in status_counts},
            "by_type": {item['case_type']: item['count'] for item in type_counts},
            "by_priority": {item['priority_level']: item['count'] for item in priority_counts},
        })

class CaseCourtDetailViewSet(viewsets.ModelViewSet):
    serializer_class = CaseCourtDetailSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['court_name', 'judge_name', 'state', 'district']
    
    def get_queryset(self):
        return CaseCourtDetail.objects.filter(
            case__client__lawyer=self.request.user
        ).select_related('case')

class CasePartyViewSet(viewsets.ModelViewSet):
    serializer_class = CasePartySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['party_type']
    search_fields = ['party_name', 'email']
    
    def get_queryset(self):
        return CaseParty.objects.filter(
            case__client__lawyer=self.request.user
        ).select_related('case')

class CaseStatusHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = CaseStatusHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ['updated_at']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        return CaseStatusHistory.objects.filter(
            case__client__lawyer=self.request.user
        ).select_related('case', 'updated_by')

class CaseStageViewSet(viewsets.ModelViewSet):
    serializer_class = CaseStageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ['started_at', 'ended_at']
    ordering = ['-started_at']
    
    def get_queryset(self):
        return CaseStage.objects.filter(
            case__client__lawyer=self.request.user
        ).select_related('case')

class CaseAppealViewSet(viewsets.ModelViewSet):
    serializer_class = CaseAppealSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CaseAppeal.objects.filter(
            parent_case__client__lawyer=self.request.user
        ).select_related('parent_case', 'appeal_case')


class CaseFinancialSummaryViewSet(viewsets.ModelViewSet):
    serializer_class = CaseFinancialSummarySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CaseFinancialSummary.objects.filter(
            case__client__lawyer=self.request.user
        ).select_related('case')
