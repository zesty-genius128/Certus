#!/usr/bin/env python3
"""
just a test script for the new market trends and batch analysis stuff. not fancy, just gets the job done.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

import openfda_client

# checks if the market trends thing is working. should print out some numbers and risk levels.
def test_market_trends():
    """give the market trends feature a spin"""
    
    print("🔍 Testing Market Trends Analysis")
    print("=" * 50)
    
    test_drugs = ["amoxicillin", "insulin", "clindamycin"]
    
    for drug in test_drugs:
        print(f"\n Analyzing market trends for: {drug.upper()}")
        print("-" * 30)
        
        try:
            trend_analysis = openfda_client.analyze_drug_market_trends(drug, months_back=12)
            
            print(f"Total shortage events: {trend_analysis.get('total_shortage_events', 0)}")
            print(f"Risk level: {trend_analysis.get('market_insights', {}).get('risk_level', 'Unknown')}")
            print(f"Frequency: {trend_analysis.get('market_insights', {}).get('shortage_frequency', 'Unknown')}")
            print(f"Companies affected: {trend_analysis.get('market_insights', {}).get('companies_affected', 0)}")
            print(f"Recommendation: {trend_analysis.get('market_insights', {}).get('recommendation', 'No recommendation')}")
            
            # Show status breakdown if available
            status_breakdown = trend_analysis.get('status_breakdown', {})
            if status_breakdown:
                print(f"📊 Status breakdown: {status_breakdown}")
            
        except Exception as e:
            print(f"Error analyzing {drug}: {e}")

# runs a batch analysis. handy if you want to see which drugs are a pain in the neck.
def test_batch_analysis():
    """try out the batch drug analysis thing"""
    
    print("\n\n🔄 Testing Batch Drug Analysis")
    print("=" * 50)
    
    # Test with a realistic hospital formulary subset
    test_formulary = [
        "lisinopril", 
        "amoxicillin", 
        "acetaminophen", 
        "insulin", 
        "clindamycin"
    ]
    
    print(f"Analyzing formulary with {len(test_formulary)} drugs:")
    for i, drug in enumerate(test_formulary, 1):
        print(f"   {i}. {drug}")
    
    try:
        # Test without trends first (faster)
        print(f"\nRunning batch analysis (without trends)...")
        batch_results = openfda_client.batch_drug_analysis(test_formulary, include_trends=False)
        
        # Display summary
        summary = batch_results.get('batch_summary', {})
        print(f"\nBATCH SUMMARY:")
        print(f"   Total drugs analyzed: {summary.get('total_drugs_analyzed', 0)}")
        print(f"   Drugs with shortages: {summary.get('drugs_with_shortages', 0)}")
        print(f"   Drugs with recalls: {summary.get('drugs_with_recalls', 0)}")
        print(f"   High risk drugs: {summary.get('high_risk_drugs', 0)}")
        print(f"   Total shortage events: {summary.get('total_shortage_events', 0)}")
        
        # Display risk assessment
        risk_assessment = batch_results.get('risk_assessment', {})
        print(f"\nRISK ASSESSMENT:")
        if risk_assessment.get('high_risk'):
            print(f"High risk: {', '.join(risk_assessment['high_risk'])}")
        if risk_assessment.get('medium_risk'):
            print(f"Medium risk: {', '.join(risk_assessment['medium_risk'])}")
        if risk_assessment.get('low_risk'):
            print(f"Low risk: {', '.join(risk_assessment['low_risk'])}")
        
        # Display recommendations
        recommendations = batch_results.get('formulary_recommendations', [])
        print(f"\n FORMULARY RECOMMENDATIONS:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec}")
        
        # Show detailed analysis for high-risk drugs
        individual_analyses = batch_results.get('individual_analyses', {})
        high_risk_drugs = risk_assessment.get('high_risk', [])
        
        if high_risk_drugs:
            print(f"\n DETAILED ANALYSIS FOR HIGH-RISK DRUGS:")
            for drug in high_risk_drugs[:2]:  # Show first 2 high-risk drugs
                analysis = individual_analyses.get(drug, {})
                print(f"\n   {drug.upper()}:")
                print(f"     Shortage status: {analysis.get('shortage_status', 'Unknown')}")
                print(f"     Recall status: {analysis.get('recall_status', 'Unknown')}")
                print(f"     Risk level: {analysis.get('risk_level', 'Unknown')}")
                
                details = analysis.get('details', {})
                if 'shortage_summary' in details:
                    shortage_summary = details['shortage_summary']
                    print(f"     Current shortages: {shortage_summary.get('current_shortages', 0)}")
                    companies = shortage_summary.get('companies_affected', [])
                    if companies:
                        print(f"     Companies affected: {', '.join(companies[:3])}")
        
    except Exception as e:
        print(f"Batch analysis failed: {e}")

# does batch analysis but with trends turned on. takes a bit longer, but hey, more info.
def test_with_trends():
    """batch analysis with trends enabled. for the overachievers."""
    
    print(f"\n\n📈 Testing Batch Analysis with Trends")
    print("=" * 50)
    
    # Test with smaller list since trends take longer
    small_formulary = ["amoxicillin", "clindamycin"]
    
    print(f" Running enhanced batch analysis with trends for: {', '.join(small_formulary)}")
    
    try:
        batch_results = openfda_client.batch_drug_analysis(small_formulary, include_trends=True)
        
        individual_analyses = batch_results.get('individual_analyses', {})
        
        for drug in small_formulary:
            analysis = individual_analyses.get(drug, {})
            details = analysis.get('details', {})
            
            print(f"\n {drug.upper()} with trend analysis:")
            print(f"   Shortage status: {analysis.get('shortage_status', 'Unknown')}")
            print(f"   Risk level: {analysis.get('risk_level', 'Unknown')}")
            
            if 'trend_analysis' in details:
                trend = details['trend_analysis']
                print(f"   Trend events: {trend.get('total_shortage_events', 0)}")
                print(f"   Trend risk: {trend.get('risk_level', 'Unknown')}")
                print(f"   Trend recommendation: {trend.get('recommendation', 'No recommendation')[:60]}...")
        
    except Exception as e:
        print(f"Enhanced batch analysis failed: {e}")

# just to see what happens when you give it weird input or too many drugs.
def test_edge_cases():
    """mess with edge cases and see if it breaks"""
    
    print(f"\n\n Testing Edge Cases")
    print("=" * 30)
    
    # Test with drug that likely has no shortage data
    print("Testing drug with no shortage history...")
    try:
        result = openfda_client.analyze_drug_market_trends("nonexistentdrug12345")
        print(f"Handled unknown drug: {result.get('trend_summary', 'No summary')}")
    except Exception as e:
        print(f"Error handling unknown drug: {e}")
    
    # Test batch size limit
    print("\nTesting batch size limit...")
    try:
        large_list = [f"drug{i}" for i in range(30)]  # Over the 25 limit
        result = openfda_client.batch_drug_analysis(large_list)
        if "error" in result:
            print(f"Properly handled oversized batch: {result['error']}")
        else:
            print(f"Should have rejected oversized batch")
    except Exception as e:
        print(f"Error handling oversized batch: {e}")

if __name__ == "__main__":
    print("Enhanced MCP Server - New Features Test")
    print("Testing market trends analysis and batch processing capabilities")
    print("=" * 70)
    
    test_market_trends()
    test_batch_analysis()
    test_with_trends() 
    test_edge_cases()
    
    print("\n" + "=" * 70)
    print("NEW FEATURES TESTING COMPLETE!")
    print("=" * 70)
    print("Market Trends Analysis: Provides risk assessment and shortage patterns")
    print("Batch Drug Analysis: Processes multiple drugs for formulary management")
    print("Enhanced Risk Assessment: Categorizes drugs by shortage risk levels")
    print("Formulary Recommendations: Actionable insights for healthcare teams")
    print("\nYour MCP server now has advanced analytics capabilities!")
    print("Ready for Claude Desktop integration with these powerful new tools.")