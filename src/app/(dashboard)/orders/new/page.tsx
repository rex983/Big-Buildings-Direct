"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

const BUILDING_TYPES = [
  "Storage Shed",
  "Garage",
  "Barn",
  "Workshop",
  "Cabin",
  "Commercial Building",
  "Custom",
];

const BUILDING_SIZES = [
  "8x10",
  "10x12",
  "10x16",
  "12x16",
  "12x20",
  "14x24",
  "16x32",
  "20x40",
  "Custom",
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export default function NewOrderPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail"),
      customerPhone: formData.get("customerPhone") || undefined,
      buildingType: formData.get("buildingType"),
      buildingSize: formData.get("buildingSize"),
      buildingColor: formData.get("buildingColor") || undefined,
      deliveryAddress: formData.get("deliveryAddress"),
      deliveryCity: formData.get("deliveryCity"),
      deliveryState: formData.get("deliveryState"),
      deliveryZip: formData.get("deliveryZip"),
      deliveryNotes: formData.get("deliveryNotes") || undefined,
      totalPrice: parseFloat(formData.get("totalPrice") as string),
      depositAmount: parseFloat(formData.get("depositAmount") as string),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors);
        } else {
          throw new Error(result.error || "Failed to create order");
        }
        return;
      }

      addToast({
        title: "Order created",
        description: `Order ${result.data.orderNumber} has been created successfully.`,
        variant: "success",
      });

      router.push(`/orders/${result.data.id}`);
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Order</h1>
        <p className="text-muted-foreground">Create a new building order</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName" required>Customer Name</Label>
              <Input
                id="customerName"
                name="customerName"
                required
                error={errors.customerName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail" required>Email</Label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                error={errors.customerEmail}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                error={errors.customerPhone}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Building Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="buildingType" required>Building Type</Label>
              <Select
                id="buildingType"
                name="buildingType"
                required
                error={errors.buildingType}
              >
                <option value="">Select type...</option>
                {BUILDING_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buildingSize" required>Building Size</Label>
              <Select
                id="buildingSize"
                name="buildingSize"
                required
                error={errors.buildingSize}
              >
                <option value="">Select size...</option>
                {BUILDING_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="buildingColor">Color</Label>
              <Input
                id="buildingColor"
                name="buildingColor"
                placeholder="e.g., Red, White, Gray"
                error={errors.buildingColor}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="deliveryAddress" required>Street Address</Label>
              <Input
                id="deliveryAddress"
                name="deliveryAddress"
                required
                error={errors.deliveryAddress}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryCity" required>City</Label>
              <Input
                id="deliveryCity"
                name="deliveryCity"
                required
                error={errors.deliveryCity}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryState" required>State</Label>
                <Select
                  id="deliveryState"
                  name="deliveryState"
                  required
                  error={errors.deliveryState}
                >
                  <option value="">State...</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryZip" required>ZIP Code</Label>
                <Input
                  id="deliveryZip"
                  name="deliveryZip"
                  required
                  error={errors.deliveryZip}
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="deliveryNotes">Delivery Notes</Label>
              <Textarea
                id="deliveryNotes"
                name="deliveryNotes"
                placeholder="Any special delivery instructions..."
                error={errors.deliveryNotes}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="totalPrice" required>Total Price ($)</Label>
              <Input
                id="totalPrice"
                name="totalPrice"
                type="number"
                step="0.01"
                min="0"
                required
                error={errors.totalPrice}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositAmount" required>Deposit Amount ($)</Label>
              <Input
                id="depositAmount"
                name="depositAmount"
                type="number"
                step="0.01"
                min="0"
                required
                error={errors.depositAmount}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Order
          </Button>
        </div>
      </form>
    </div>
  );
}
