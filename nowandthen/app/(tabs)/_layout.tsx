import { Tabs } from 'expo-router';
import React from 'react';
import { Image } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
  
      }}>
      
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <Image 
              source={require('../../assets/images/friends.png')} 
              style={{ width: 32, height: 25, tintColor: color }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Image 
              source={require('../../assets/images/home.png')} 
              style={{ width: 28, height: 28, tintColor: color }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Image 
              source={require('../../assets/images/gear.png')} 
              style={{ width: 28, height: 28, tintColor: color }}
            />
          ),
        }}
      />
    </Tabs>
    
  );
}
