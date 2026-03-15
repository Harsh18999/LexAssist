from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from api.models import *

class CustomTokenSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):

        token = super().get_token(user)

        token["username"] = user.username
    
        return token

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        exclude = ['lawyer']
        read_only_fields = ['id', 'created_at']


class CaseSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Case
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class CaseCourtDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseCourtDetail
        fields = '__all__'
        read_only_fields = ['id']


class CasePartySerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseParty
        fields = '__all__'
        read_only_fields = ['id']


class CaseStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseStatusHistory
        fields = '__all__'
        read_only_fields = ['id', 'updated_at']


class CaseStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseStage
        fields = '__all__'
        read_only_fields = ['id']


class CaseAppealSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseAppeal
        fields = '__all__'
        read_only_fields = ['id']


class CaseFinancialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseFinancialSummary
        fields = '__all__'
