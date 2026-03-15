from django.urls import path, include
from api.views import UserViewSet, ClientViewSet, CaseViewSet, CaseCourtDetailViewSet, CasePartyViewSet, CaseStatusHistoryViewSet, CaseStageViewSet, CaseAppealViewSet, CaseFinancialSummaryViewSet, RegisterUserViewSet, LoginView, LogoutView, ProfileView
from rest_framework import routers

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'clients', ClientViewSet, basename='clients')
router.register(r'cases', CaseViewSet, basename='cases')
router.register(r'case-court-details', CaseCourtDetailViewSet, basename='case-court-details')
router.register(r'case-parties', CasePartyViewSet, basename='case-parties')
router.register(r'case-status-history', CaseStatusHistoryViewSet, basename='case-status-history')
router.register(r'case-stages', CaseStageViewSet, basename='case-stages')
router.register(r'case-appeals', CaseAppealViewSet, basename='case-appeals')
router.register(r'case-financial-summaries', CaseFinancialSummaryViewSet, basename='case-financial-summaries')

urlpatterns = [
    path('register/', RegisterUserViewSet.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('', include(router.urls)),
]
